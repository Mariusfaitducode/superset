import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Deterministic PRNG, so the fixture and its expected numbers never drift. */
function mulberry32(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const PARIS_OFFSET_MS = 2 * 60 * 60 * 1000;

const MESSAGES = [
	"commit et push",
	"où en sommes-nous ?",
	"non pas ça, je t'ai dit de garder l'API telle quelle",
	"continue",
	"super tu peux post",
	"Regarde pourquoi le test d'intégration échoue sur la CI et corrige la cause, pas le symptôme. Garde le comportement actuel pour les anciens clients.",
	"<pasted_content>[10:42 AM] Victor: on peut merger la PR ?</pasted_content> réponds-lui",
	"ok, ajoute un test pour ce cas et vérifie que la migration passe",
	"Ajoute une colonne pour le statut dans la vue, triée par date",
];

interface Line {
	ms: number;
	body: Record<string, unknown>;
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

class SessionWriter {
	readonly lines: Line[] = [];
	constructor(
		readonly sessionId: string,
		readonly cwd: string,
		readonly entrypoint: string,
	) {}

	private push(ms: number, body: Record<string, unknown>) {
		this.lines.push({
			ms,
			body: {
				...body,
				cwd: this.cwd,
				entrypoint: this.entrypoint,
				sessionId: this.sessionId,
				timestamp: iso(ms),
			},
		});
	}

	human(ms: number, text: string) {
		this.push(ms, {
			type: "user",
			promptSource: "user",
			message: { role: "user", content: text },
		});
	}

	assistant(ms: number, text: string, tool: string | null) {
		const content: unknown[] = [{ type: "text", text }];
		if (tool) content.push({ type: "tool_use", name: tool, input: {} });
		this.push(ms, {
			type: "assistant",
			message: { role: "assistant", content },
		});
	}

	toolResult(ms: number) {
		this.push(ms, {
			type: "user",
			message: {
				role: "user",
				content: [{ type: "tool_result", content: "ok", is_error: false }],
			},
		});
	}

	meta(ms: number) {
		this.push(ms, {
			type: "user",
			isMeta: true,
			message: {
				role: "user",
				content: "<system-reminder>ctx</system-reminder>",
			},
		});
		this.push(ms, {
			type: "user",
			message: {
				role: "user",
				content: "<task-notification>agent done</task-notification>",
			},
		});
		this.push(ms, { type: "attachment", attachment: {} });
	}

	stop(ms: number) {
		this.push(ms, { type: "system", subtype: "stop_hook_summary" });
		this.push(ms + 50, { type: "system", subtype: "turn_duration" });
	}

	text(): string {
		return `${this.lines.map((line) => JSON.stringify(line.body)).join("\n")}\n`;
	}
}

export const SYNTHETIC_DAYS = [
	"2026-10-01",
	"2026-10-02",
	"2026-10-05",
	"2026-10-06",
	"2026-10-07",
	"2026-10-08",
	"2026-10-09",
	"2026-10-12",
	"2026-10-13",
	"2026-10-14",
];

function parisMs(day: string, hour: number, minute: number): number {
	return (
		Date.parse(
			`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
		) - PARIS_OFFSET_MS
	);
}

/**
 * Two weeks of a heavy user's Claude sessions: three interactive sessions a
 * day plus one automation, reply gaps around five minutes, one resumed
 * session that copies its parent's events, and lines the metrics ignore.
 */
export function buildSyntheticTranscripts(seed = 7): SessionWriter[] {
	const random = mulberry32(seed);
	const sessions: SessionWriter[] = [];
	let counter = 0;

	for (const day of SYNTHETIC_DAYS) {
		for (const [hour, minute] of [
			[9, 30],
			[10, 5],
			[14, 0],
		] as const) {
			counter++;
			const repo = ["hub", "spore-app", "superset"][counter % 3];
			const session = new SessionWriter(
				`session-${String(counter).padStart(3, "0")}`,
				`/Users/marius/CodeProjects/${repo}`,
				"cli",
			);
			let ms = parisMs(day, hour, minute);
			const turns = 6 + Math.floor(random() * 5);
			for (let turn = 0; turn < turns; turn++) {
				const text =
					turn === 0 && counter % 4 === 0
						? "Tu es l'agent de la feature X. Lis la spec."
						: (MESSAGES[Math.floor(random() * MESSAGES.length)] as string);
				session.human(ms, text);
				if (random() < 0.3) session.meta(ms + 500);
				const actions = 4 + Math.floor(random() * 14);
				for (let action = 0; action < actions; action++) {
					ms += 20_000 + Math.floor(random() * 70_000);
					const tool = random() < 0.7 ? "Bash" : null;
					session.assistant(ms, `step ${action}`, tool);
					if (tool) session.toolResult(ms + 4_000);
				}
				ms += 6_000;
				session.stop(ms);
				const gapMinutes =
					random() < 0.85 ? 0.3 + random() * 12 : 40 + random() * 120;
				ms += Math.floor(gapMinutes * 60_000);
			}
			sessions.push(session);
		}

		counter++;
		const automation = new SessionWriter(
			`automation-${String(counter).padStart(3, "0")}`,
			"/Users/marius/CodeProjects/hub",
			"sdk-cli",
		);
		let ms = parisMs(day, 7, 0);
		automation.human(ms, "Scan yesterday's sessions and name new workspaces");
		for (let action = 0; action < 10; action++) {
			ms += 30_000;
			automation.assistant(ms, "scan", "Bash");
			automation.toolResult(ms + 1_000);
		}
		automation.stop(ms + 2_000);
		sessions.push(automation);
	}

	// A resumed session: the parent's history copied ahead of its own turns.
	const parent = sessions[0] as SessionWriter;
	const resumed = new SessionWriter("resumed-001", parent.cwd, "cli");
	resumed.lines.push(...parent.lines);
	let ms = (parent.lines[parent.lines.length - 1] as Line).ms + 30 * 60_000;
	for (let turn = 0; turn < 3; turn++) {
		resumed.human(ms, "continue");
		for (let action = 0; action < 5; action++) {
			ms += 40_000;
			resumed.assistant(ms, "resumed step", "Bash");
			resumed.toolResult(ms + 2_000);
		}
		ms += 3_000;
		resumed.stop(ms);
		ms += 4 * 60_000;
	}
	sessions.push(resumed);
	return sessions;
}

/** Writes the fixture the way Claude Code lays out `~/.claude/projects`. */
export function writeSyntheticTranscripts(root: string, seed = 7): void {
	for (const session of buildSyntheticTranscripts(seed)) {
		const dir = join(root, session.cwd.replaceAll("/", "-"));
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, `${session.sessionId}.jsonl`), session.text());
		const subagents = join(dir, session.sessionId, "subagents");
		mkdirSync(subagents, { recursive: true });
		writeFileSync(
			join(subagents, "agent-1.jsonl"),
			`${JSON.stringify({
				type: "user",
				timestamp: iso(session.lines[0]?.ms ?? 0),
				message: { role: "user", content: "subagent prompt" },
			})}\n`,
		);
	}
}

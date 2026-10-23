/** What one transcript line counts as. Only these kinds matter to the metrics. */
export const EVENT_KINDS = [
	"human",
	"interrupt",
	"tool_result",
	"assistant",
	"stop",
	"other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Bit flags on a human message, decided once from its text so the cache never keeps the text. */
export const MESSAGE_FLAGS = {
	/** A prompt written by an agent or a script, pasted into a session as if typed. */
	agentWritten: 1,
	goAhead: 2,
	statusCheck: 4,
	correction: 8,
	pasted: 16,
} as const;

/**
 * `[timestampMs, kind, a, b]`. For `human`, `a` is the text length and `b`
 * the flags; for `assistant`, `a` is the text length and `b` the tool names
 * joined by commas. A tuple keeps the per-file cache small on disk.
 */
export type InsightEvent = [number, EventKind, number?, (number | string)?];

const AGENT_WRITTEN =
	/^(Tu es l'agent|You are the|Coordinateur|SUPERSET_WORKER|\[Artifact comment)/i;
const GO_AHEAD =
	/^(oui|ok|super|très bien|parfait|go|vas-?y|ok vasy|yes|sure|great|perfect)?[ ,!.]*.{0,40}\b(push|post|poste|merge|go|commit|tag|release|vas-?y|lance|ship)\b/i;
const STATUS_CHECK =
	/o[uù] en (sommes|est)|^continue|c'est quoi l'état|status|statut|where are we|^keep going/i;
const CORRECTION =
	/\b(non|pas ça|pourquoi|toujours pas|marche pas|arrête|j'ai dit|je t'ai dit|n'importe quoi|faux|wrong|i said|i told you|still not|doesn't work)\b/i;
const PASTED = /pasted_content|\[\d+:\d+ [AP]M\]|github\.com\/.+\/pull\//i;

export function messageFlags(text: string): number {
	const head = text.slice(0, 400).toLowerCase();
	let flags = 0;
	if (AGENT_WRITTEN.test(text)) flags |= MESSAGE_FLAGS.agentWritten;
	if (GO_AHEAD.test(head)) flags |= MESSAGE_FLAGS.goAhead;
	if (STATUS_CHECK.test(head)) flags |= MESSAGE_FLAGS.statusCheck;
	if (CORRECTION.test(head)) flags |= MESSAGE_FLAGS.correction;
	if (PASTED.test(head)) flags |= MESSAGE_FLAGS.pasted;
	return flags;
}

type ContentBlock = { type?: unknown; text?: unknown; name?: unknown };

function blocksOf(content: unknown): ContentBlock[] {
	return Array.isArray(content)
		? content.filter(
				(block): block is ContentBlock =>
					typeof block === "object" && block !== null,
			)
		: [];
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	return blocksOf(content)
		.filter((block) => block.type === "text")
		.map((block) => (typeof block.text === "string" ? block.text : ""))
		.join("\n");
}

const NOT_TYPED_PREFIXES = [
	"Base directory for this skill",
	"<system-reminder>",
	"Caveat:",
	"<local-command-stdout>",
	"<bash-stdout>",
	"<bash-input>",
	"<task-notification>",
];

/** Same rules as the analysis scripts' `classify_user`: only text a person typed is `human`. */
function classifyUser(line: Record<string, unknown>): InsightEvent[1] {
	const message = (line.message ?? {}) as { content?: unknown };
	const content = message.content;
	if (blocksOf(content).some((block) => block.type === "tool_result")) {
		return "tool_result";
	}
	const text = textOf(content).trim();
	if (!text) return "other";
	if (line.isMeta) return "other";
	if (text.startsWith("[Request interrupted")) return "interrupt";
	if (NOT_TYPED_PREFIXES.some((prefix) => text.startsWith(prefix))) {
		return "other";
	}
	const origin = (line.origin as { kind?: unknown } | undefined)?.kind;
	if (text.startsWith("<command-message>") && origin !== "human") {
		return "other";
	}
	if (
		text
			.slice(0, 300)
			.includes("This session is being continued from a previous conversation")
	) {
		return "other";
	}
	if (origin && origin !== "human") return "other";
	return "human";
}

export interface ParsedLine {
	event: InsightEvent;
	cwd: string | null;
	entrypoint: string | null;
}

/** One transcript line to one event, or null for lines the metrics ignore. */
export function parseTranscriptLine(raw: string): ParsedLine | null {
	let line: Record<string, unknown>;
	try {
		line = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof line !== "object" || line === null) return null;
	const type = line.type;
	if (type !== "user" && type !== "assistant" && type !== "system") {
		return null;
	}
	const ms =
		typeof line.timestamp === "string" ? Date.parse(line.timestamp) : NaN;
	if (Number.isNaN(ms)) return null;
	const cwd = typeof line.cwd === "string" ? line.cwd : null;
	const entrypoint =
		typeof line.entrypoint === "string" ? line.entrypoint : null;

	let event: InsightEvent;
	if (type === "user") {
		const kind = classifyUser(line);
		if (kind === "human") {
			const text = textOf(
				(line.message as { content?: unknown } | undefined)?.content,
			).trim();
			event = [ms, kind, text.length, messageFlags(text)];
		} else {
			event = [ms, kind];
		}
	} else if (type === "assistant") {
		const content = (line.message as { content?: unknown } | undefined)
			?.content;
		const tools = blocksOf(content)
			.filter((block) => block.type === "tool_use")
			.map((block) => String(block.name))
			.join(",");
		event = [ms, "assistant", textOf(content).length, tools];
	} else {
		const subtype = line.subtype;
		event =
			subtype === "stop_hook_summary" || subtype === "turn_duration"
				? [ms, "stop"]
				: [ms, "other"];
	}
	return { event, cwd, entrypoint };
}

import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const OBSERVER_MISSIONS = ["superset", "work", "efficiency"] as const;
export const FINDING_PRIORITIES = ["high", "normal"] as const;
export const RUN_STATUSES = ["running", "done", "abandoned"] as const;

export type ObserverMission = (typeof OBSERVER_MISSIONS)[number];
export type FindingPriority = (typeof FINDING_PRIORITIES)[number];
export type ObserverRunStatus = (typeof RUN_STATUSES)[number];

export interface ObserverFinding {
	mission: ObserverMission;
	priority: FindingPriority;
	title: string;
	detail: string | null;
	link: string | null;
	/** The conversation the finding is about, to open it from the Office. */
	workspaceId: string | null;
	terminalId: string | null;
}

export interface ObserverSynthesis {
	headline: string;
	findings: ObserverFinding[];
	/** The dated Markdown synthesis the observer wrote, when it wrote one. */
	file: string | null;
}

export interface ObserverRun {
	id: string;
	workspaceId: string;
	terminalId: string;
	status: ObserverRunStatus;
	startedAt: number;
	finishedAt: number | null;
	synthesis: ObserverSynthesis | null;
}

export interface ObserverConfig {
	/** Agent preset id or host agent config id that "Run now" starts. */
	agent: string | null;
}

export interface NewFinding {
	mission: ObserverMission;
	priority?: FindingPriority;
	title: string;
	detail?: string | null;
	link?: string | null;
	workspaceId?: string | null;
	terminalId?: string | null;
}

export interface NewSynthesis {
	workspaceId: string;
	terminalId: string;
	headline: string;
	findings: NewFinding[];
	file?: string | null;
}

export const MAX_RUNS = 20;

interface ObserverFile {
	version: 1;
	config: ObserverConfig;
	runs: ObserverRun[];
}

export function defaultObserverPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "office-observer.json");
}

/**
 * The Office observer's runs and what each one found. One run at a time: a
 * new run closes a run that never published as abandoned. Newest first.
 */
export class OfficeObserverStore {
	private state: ObserverFile | null = null;

	constructor(
		private readonly filePath: string = defaultObserverPath(),
		private readonly now: () => number = Date.now,
	) {}

	get(limit = 5): { config: ObserverConfig; runs: ObserverRun[] } {
		const state = this.load();
		return { config: state.config, runs: state.runs.slice(0, limit) };
	}

	setConfig(config: ObserverConfig): ObserverConfig {
		const state = this.load();
		const next = { agent: config.agent?.trim() || null };
		this.save({ ...state, config: next });
		return next;
	}

	begin(input: { workspaceId: string; terminalId: string }): ObserverRun {
		const state = this.load();
		const at = this.now();
		const run: ObserverRun = {
			id: randomUUID(),
			workspaceId: input.workspaceId,
			terminalId: input.terminalId,
			status: "running",
			startedAt: at,
			finishedAt: null,
			synthesis: null,
		};
		this.save({
			...state,
			runs: [run, ...state.runs.map((item) => abandon(item, at))],
		});
		return run;
	}

	/** Closes this conversation's run; a run that skipped `begin` is created. */
	publish(input: NewSynthesis): ObserverRun {
		const headline = input.headline.trim();
		if (!headline) throw new Error("A synthesis needs a headline");
		const synthesis: ObserverSynthesis = {
			headline,
			findings: input.findings.map((finding) => ({
				mission: finding.mission,
				priority: finding.priority ?? "normal",
				title: finding.title.trim(),
				detail: finding.detail?.trim() || null,
				link: finding.link?.trim() || null,
				workspaceId: finding.workspaceId || null,
				terminalId: finding.terminalId || null,
			})),
			file: input.file?.trim() || null,
		};
		const state = this.load();
		const at = this.now();
		const own = state.runs.find(
			(run) => run.terminalId === input.terminalId && run.status === "running",
		);
		const run: ObserverRun = {
			id: own?.id ?? randomUUID(),
			workspaceId: input.workspaceId,
			terminalId: input.terminalId,
			status: "done",
			startedAt: own?.startedAt ?? at,
			finishedAt: at,
			synthesis,
		};
		const others = state.runs
			.filter((item) => item.id !== run.id)
			.map((item) => abandon(item, at));
		this.save({ ...state, runs: [run, ...others] });
		return run;
	}

	private load(): ObserverFile {
		if (this.state) return this.state;
		try {
			const file = JSON.parse(
				readFileSync(this.filePath, "utf8"),
			) as Partial<ObserverFile>;
			this.state = {
				version: 1,
				config: { agent: file.config?.agent ?? null },
				runs: Array.isArray(file.runs) ? file.runs : [],
			};
		} catch {
			this.state = { version: 1, config: { agent: null }, runs: [] };
		}
		return this.state;
	}

	private save(state: ObserverFile): void {
		this.state = { ...state, runs: state.runs.slice(0, MAX_RUNS) };
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			writeFileSync(temporaryPath, JSON.stringify(this.state, null, "\t"));
			renameSync(temporaryPath, this.filePath);
		} catch (error) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Best-effort cleanup after a failed write or rename.
			}
			throw error;
		}
	}
}

function abandon(run: ObserverRun, at: number): ObserverRun {
	return run.status === "running"
		? { ...run, status: "abandoned", finishedAt: at }
		: run;
}

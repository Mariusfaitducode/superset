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

export const REPORT_KINDS = [
	"done",
	"decision",
	"draft",
	"blocked",
	"progress",
] as const;
export const REPORT_STATUSES = ["open", "answered", "dismissed"] as const;
export const REPORT_ACTORS = ["user", "agent"] as const;
export const DRAFT_TARGETS = ["slack", "github", "notion", "email"] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportActor = (typeof REPORT_ACTORS)[number];
export type DraftTarget = (typeof DRAFT_TARGETS)[number];

export interface ReportDraft {
	text: string;
	target: DraftTarget;
}

export interface AgentReport {
	id: string;
	workspaceId: string;
	terminalId: string;
	kind: ReportKind;
	summary: string;
	details: string | null;
	links: string[];
	checks: string | null;
	/** What the user should try to check the work. */
	test: string | null;
	options: string[];
	draft: ReportDraft | null;
	status: ReportStatus;
	answer: string | null;
	/** The newer report of the same kind that closed this one. */
	supersededBy: string | null;
	createdBy: ReportActor;
	createdAt: number;
	updatedAt: number;
	answeredAt: number | null;
}

export interface NewReport {
	actor: ReportActor;
	workspaceId: string;
	terminalId: string;
	kind: ReportKind;
	summary: string;
	details?: string | null;
	links?: string[];
	checks?: string | null;
	test?: string | null;
	options?: string[];
	draft?: ReportDraft | null;
}

export class ReportPermissionError extends Error {}
export class ReportNotFoundError extends Error {}
export class ReportClosedError extends Error {}

export const MAX_CONVERSATIONS = 200;
export const MAX_REPORTS_PER_CONVERSATION = 50;

interface ReportFile {
	version: 1;
	reports: AgentReport[];
}

export function defaultReportsPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "agent-reports.json");
}

/**
 * What agents hand over to the user: work to review, a choice, a text to
 * send in the user's name, a blocker. One open report per kind and
 * conversation: a new one closes the previous, so the user never answers
 * the same question twice. Only the user answers; an agent may withdraw.
 */
export class AgentReportStore {
	private reports: AgentReport[] | null = null;

	constructor(
		private readonly filePath: string = defaultReportsPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(
		filter: {
			workspaceId?: string;
			terminalId?: string;
			status?: ReportStatus;
		} = {},
	) {
		return this.load().filter(
			(report) =>
				(!filter.workspaceId || report.workspaceId === filter.workspaceId) &&
				(!filter.terminalId || report.terminalId === filter.terminalId) &&
				(!filter.status || report.status === filter.status),
		);
	}

	create(input: NewReport): AgentReport {
		const summary = input.summary.trim();
		if (!summary) throw new Error("A report needs a summary");
		if (input.kind === "draft" && !input.draft?.text.trim()) {
			throw new Error("A draft report needs the text to send");
		}
		const at = this.now();
		const report: AgentReport = {
			id: randomUUID(),
			workspaceId: input.workspaceId,
			terminalId: input.terminalId,
			kind: input.kind,
			summary,
			details: input.details?.trim() || null,
			links: input.links ?? [],
			checks: input.checks?.trim() || null,
			test: input.test?.trim() || null,
			options: (input.options ?? []).map((option) => option.trim()),
			draft: input.draft ?? null,
			status: "open",
			answer: null,
			supersededBy: null,
			createdBy: input.actor,
			createdAt: at,
			updatedAt: at,
			answeredAt: null,
		};
		const reports = this.load().map((item) =>
			item.status === "open" &&
			item.terminalId === report.terminalId &&
			item.kind === report.kind
				? {
						...item,
						status: "dismissed" as const,
						supersededBy: report.id,
						updatedAt: at,
					}
				: item,
		);
		this.save([...reports, report]);
		return report;
	}

	answer(actor: ReportActor, id: string, answer: string): AgentReport {
		if (actor !== "user") {
			throw new ReportPermissionError("Only the user answers a report");
		}
		const report = this.getOpen(id);
		const at = this.now();
		return this.replace({
			...report,
			status: "answered",
			answer: answer.trim() || null,
			answeredAt: at,
		});
	}

	dismiss(actor: ReportActor, id: string): AgentReport {
		const report = this.getOpen(id);
		if (actor === "agent" && report.createdBy !== "agent") {
			throw new ReportPermissionError(
				"Agents can withdraw their own reports only",
			);
		}
		return this.replace({ ...report, status: "dismissed" });
	}

	private getOpen(id: string): AgentReport {
		const report = this.load().find((item) => item.id === id);
		if (!report) throw new ReportNotFoundError(`Report not found: ${id}`);
		if (report.status !== "open") {
			throw new ReportClosedError(`Report already ${report.status}: ${id}`);
		}
		return report;
	}

	private replace(report: AgentReport): AgentReport {
		const updated = { ...report, updatedAt: this.now() };
		this.save(
			this.load().map((item) => (item.id === report.id ? updated : item)),
		);
		return updated;
	}

	private load(): AgentReport[] {
		if (this.reports) return this.reports;
		try {
			const file = JSON.parse(
				readFileSync(this.filePath, "utf8"),
			) as ReportFile;
			this.reports = Array.isArray(file.reports) ? file.reports : [];
		} catch {
			this.reports = [];
		}
		return this.reports;
	}

	private save(reports: AgentReport[]): void {
		this.reports = bound(reports);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: ReportFile = { version: 1, reports: this.reports };
			writeFileSync(temporaryPath, JSON.stringify(file, null, "\t"));
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

// Open reports are what the user still owes an answer, so the caps drop
// closed history first.
function bound(reports: AgentReport[]): AgentReport[] {
	const byTerminal = new Map<string, AgentReport[]>();
	for (const report of reports) {
		const list = byTerminal.get(report.terminalId) ?? [];
		list.push(report);
		byTerminal.set(report.terminalId, list);
	}
	const lastTouched = (list: AgentReport[]) =>
		Math.max(...list.map((report) => report.updatedAt));
	const trim = (list: AgentReport[]) => {
		const excess = list.length - MAX_REPORTS_PER_CONVERSATION;
		if (excess <= 0) return list;
		const dropped = new Set(
			list
				.filter((report) => report.status !== "open")
				.slice(0, excess)
				.map((report) => report.id),
		);
		return list
			.filter((report) => !dropped.has(report.id))
			.slice(-MAX_REPORTS_PER_CONVERSATION);
	};
	return [...byTerminal.values()]
		.sort((a, b) => lastTouched(b) - lastTouched(a))
		.slice(0, MAX_CONVERSATIONS)
		.flatMap(trim);
}

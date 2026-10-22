import { readFileSync } from "node:fs";
import { CLIError } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";

export type Report = Awaited<
	ReturnType<HostServiceClient["agentReports"]["list"]["query"]>
>[number];

export const REPORT_KINDS = [
	"done",
	"decision",
	"draft",
	"blocked",
	"progress",
] as const;
export const DRAFT_TARGETS = ["slack", "github", "notion", "email"] as const;

/** A draft report carries the exact text to send, read from a file. */
export function readDraft(
	kind: string,
	options: { draftFile?: string; target?: (typeof DRAFT_TARGETS)[number] },
	read: (path: string) => string = (path) => readFileSync(path, "utf8"),
) {
	if (kind !== "draft") {
		if (options.draftFile || options.target) {
			throw new CLIError("--draft-file and --target go with a draft report");
		}
		return undefined;
	}
	if (!options.draftFile || !options.target) {
		throw new CLIError(
			"A draft report needs the text and where it goes",
			"Pass --draft-file <path> --target slack|github|notion|email",
		);
	}
	let text: string;
	try {
		text = read(options.draftFile);
	} catch {
		throw new CLIError(`Cannot read ${options.draftFile}`);
	}
	if (!text.trim()) throw new CLIError(`${options.draftFile} is empty`);
	return { text, target: options.target };
}

/** Accepts the short id `reports list` prints, as long as it is unambiguous. */
export function resolveReportId(idOrPrefix: string, reports: Report[]): string {
	const matches = reports.filter((report) => report.id.startsWith(idOrPrefix));
	if (matches.length === 1 && matches[0]) return matches[0].id;
	throw new CLIError(
		matches.length === 0
			? `Report not found: ${idOrPrefix}`
			: `Several reports start with ${idOrPrefix}`,
		"Run: superset reports list --all",
	);
}

export function reportRows(reports: Report[]) {
	return reports.map((report) => ({
		id: report.id.slice(0, 8),
		kind: report.kind,
		status: report.status,
		summary: report.summary,
		answer: report.answer ?? "",
	}));
}

/** Reports live on the host of this machine, where the agents run. */
export async function localReportsClient(ctx: CliContext) {
	return (await localHostClient(ctx)).agentReports;
}

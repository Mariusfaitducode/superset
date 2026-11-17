import type { HostServiceClient } from "renderer/lib/host-service-client";

type ObserverState = Awaited<
	ReturnType<HostServiceClient["officeObserver"]["get"]["query"]>
>;
export type ObserverRun = ObserverState["runs"][number];
export type ObserverFinding = NonNullable<
	ObserverRun["synthesis"]
>["findings"][number];
export type ObserverMission = ObserverFinding["mission"];

export const OBSERVER_MISSION_ORDER: ObserverMission[] = [
	"work",
	"efficiency",
	"superset",
];

/** A run that has not published after this long is shown as stalled. */
export const OBSERVER_STALL_MS = 60 * 60_000;

export type ObserverStatus =
	| { kind: "never" }
	| { kind: "starting" }
	| { kind: "running"; run: ObserverRun }
	| { kind: "stalled"; run: ObserverRun }
	| { kind: "idle"; run: ObserverRun };

/**
 * What the observer's desk says: never run, starting (the user just asked),
 * running, stalled (a run that never published), or idle since its last run.
 */
export function observerStatus(
	runs: readonly ObserverRun[],
	now: number,
	startRequestedAt: number | null,
): ObserverStatus {
	const latest = runs[0];
	if (
		startRequestedAt !== null &&
		(!latest || latest.startedAt < startRequestedAt) &&
		now - startRequestedAt < OBSERVER_STALL_MS
	) {
		return { kind: "starting" };
	}
	if (!latest) return { kind: "never" };
	if (latest.status === "running") {
		return now - latest.startedAt < OBSERVER_STALL_MS
			? { kind: "running", run: latest }
			: { kind: "stalled", run: latest };
	}
	return { kind: "idle", run: latest };
}

/** The last run that published, which the panel shows while a new one runs. */
export function latestSynthesis(runs: readonly ObserverRun[]) {
	return runs.find((run) => run.synthesis !== null) ?? null;
}

/** Findings by mission, the work first, high priority first in each. */
export function groupFindings(findings: readonly ObserverFinding[]) {
	return OBSERVER_MISSION_ORDER.map((mission) => ({
		mission,
		findings: findings
			.filter((finding) => finding.mission === mission)
			.sort(
				(a, b) => Number(b.priority === "high") - Number(a.priority === "high"),
			),
	})).filter((group) => group.findings.length > 0);
}

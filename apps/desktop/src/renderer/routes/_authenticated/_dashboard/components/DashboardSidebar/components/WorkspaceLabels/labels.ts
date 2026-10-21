import type { HostServiceClient } from "renderer/lib/host-service-client";

export type WorkspaceLabelsState = Awaited<
	ReturnType<HostServiceClient["workspaceLabels"]["list"]["query"]>
>;
export type WorkspaceLabel = WorkspaceLabelsState["labels"][number];
export type LabelColor = WorkspaceLabel["color"];

export const LABEL_COLORS: LabelColor[] = [
	"gray",
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"blue",
	"violet",
	"pink",
];

/** Tailwind can only keep classes it sees written out in full. */
export const LABEL_PILL_CLASS: Record<LabelColor, string> = {
	gray: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
	red: "bg-red-500/15 text-red-600 dark:text-red-400",
	orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
	amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
	green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	teal: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
	blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
	violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
	pink: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
};

export const LABEL_DOT_CLASS: Record<LabelColor, string> = {
	gray: "bg-zinc-500",
	red: "bg-red-500",
	orange: "bg-orange-500",
	amber: "bg-amber-500",
	green: "bg-emerald-500",
	teal: "bg-teal-500",
	blue: "bg-blue-500",
	violet: "bg-violet-500",
	pink: "bg-pink-500",
};

export function workspaceLabels(
	state: WorkspaceLabelsState | null | undefined,
	workspaceId: string,
): WorkspaceLabel[] {
	if (!state) return [];
	const ids = new Set(state.assignments[workspaceId] ?? []);
	return state.labels.filter((label) => ids.has(label.id));
}

/**
 * A workspace passes when it has every selected label. Labels are matched by
 * name, ignoring case, since each host keeps its own.
 */
export function hasAllLabels(
	labels: WorkspaceLabel[],
	selectedNames: string[],
): boolean {
	const names = new Set(labels.map((label) => label.name.toLowerCase()));
	return selectedNames.every((name) => names.has(name.toLowerCase()));
}

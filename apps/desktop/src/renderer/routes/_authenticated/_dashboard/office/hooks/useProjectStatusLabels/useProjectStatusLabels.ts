import { useLingui } from "@lingui/react/macro";
import type { ProjectStatus } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";

/** Notion's colors for the "Projects" statuses. */
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
	inProgress: "#eab308",
	planning: "#3b82f6",
	paused: "#a855f7",
	backlog: "#a1a1aa",
	done: "#22c55e",
	canceled: "#ef4444",
};

/** Notion's words for project statuses, plus one for a project without one. */
export function useProjectStatusLabels(): Record<
	ProjectStatus | "none",
	string
> {
	const { t } = useLingui();
	return {
		inProgress: t({ message: "In progress", context: "project status" }),
		planning: t({ message: "Planning", context: "project status" }),
		paused: t({ message: "Paused", context: "project status" }),
		backlog: t({ message: "Backlog", context: "project status" }),
		done: t({ message: "Done", context: "project status" }),
		canceled: t({ message: "Canceled", context: "project status" }),
		none: t({ message: "No status", context: "project status" }),
	};
}

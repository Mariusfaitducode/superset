import type { AccessibleV2Workspace } from "../../hooks/useAccessibleV2Workspaces";
import { useWorkspacesLabelViewStore } from "../../stores/workspacesLabelView";
import { V2WorkspacesBoard } from "../V2WorkspacesBoard";
import { V2WorkspacesList } from "../V2WorkspacesList";
import { WorkspacesLabelBoard } from "./WorkspacesLabelBoard";
import { useLabelFilteredWorkspaces } from "./WorkspacesLabelsProvider";

/** The page's board or list, after the label filter, grouped as chosen. */
export function LabeledWorkspacesViews({
	viewMode,
	workspaces,
	isReady,
}: {
	viewMode: "board" | "list";
	workspaces: AccessibleV2Workspace[];
	isReady: boolean;
}) {
	const groupBy = useWorkspacesLabelViewStore((state) => state.groupBy);
	const filtered = useLabelFilteredWorkspaces(workspaces);
	if (viewMode === "list") {
		return <V2WorkspacesList workspaces={filtered} isReady={isReady} />;
	}
	return groupBy === "label" ? (
		<WorkspacesLabelBoard workspaces={filtered} isReady={isReady} />
	) : (
		<V2WorkspacesBoard workspaces={filtered} isReady={isReady} />
	);
}

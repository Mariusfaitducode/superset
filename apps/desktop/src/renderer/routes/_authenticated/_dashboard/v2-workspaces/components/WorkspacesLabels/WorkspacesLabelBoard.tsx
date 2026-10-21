import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useMemo } from "react";
import { LABEL_DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import type { AccessibleV2Workspace } from "../../hooks/useAccessibleV2Workspaces";
import { useV2WorkspacesFilterStore } from "../../stores/v2WorkspacesFilterStore";
import { isWithinArchivedWindow } from "../../utils/archivedWindow";
import { compareWorkspaces } from "../../utils/sortWorkspaces";
import { V2WorkspacesBoardCard } from "../V2WorkspacesBoard/components/V2WorkspacesBoardCard";
import { useWorkspacesLabels } from "./WorkspacesLabelsProvider";

const NO_LABEL = "";

/**
 * The board with one column per label, then one for unlabeled workspaces.
 * A workspace with several labels shows in each of their columns.
 */
export function WorkspacesLabelBoard({
	workspaces,
	isReady,
}: {
	workspaces: AccessibleV2Workspace[];
	isReady: boolean;
}) {
	const { labels, labelsOf } = useWorkspacesLabels();
	const archivedWindow = useV2WorkspacesFilterStore(
		(state) => state.archivedWindow,
	);
	const sortMode = useV2WorkspacesFilterStore((state) => state.sortMode);

	const byColumn = useMemo(() => {
		const now = Date.now();
		const map = new Map<string, AccessibleV2Workspace[]>([
			...labels.map(
				(label) =>
					[label.name.toLowerCase(), []] as [string, AccessibleV2Workspace[]],
			),
			[NO_LABEL, []],
		]);
		for (const workspace of workspaces) {
			if (
				workspace.archivedAt != null &&
				!isWithinArchivedWindow(workspace.archivedAt, archivedWindow, now)
			) {
				continue;
			}
			const own = labelsOf(workspace);
			if (own.length === 0) map.get(NO_LABEL)?.push(workspace);
			for (const label of own)
				map.get(label.name.toLowerCase())?.push(workspace);
		}
		for (const column of map.values()) {
			column.sort((a, b) => compareWorkspaces(a, b, sortMode));
		}
		return map;
	}, [workspaces, labels, labelsOf, archivedWindow, sortMode]);

	if (workspaces.length === 0 && !isReady) return null;

	const columns = [
		...labels.map((label) => ({
			key: label.name.toLowerCase(),
			name: label.name,
			dot: LABEL_DOT_CLASS[label.color],
		})),
		{ key: NO_LABEL, name: null, dot: "bg-muted-foreground/30" },
	];

	return (
		<div className="flex-1 overflow-x-auto overflow-y-hidden">
			<div className="flex h-full min-w-max gap-3 px-6 py-4">
				{columns.map((column) => {
					const items = byColumn.get(column.key) ?? [];
					return (
						<div
							key={column.key || "none"}
							className="flex w-[280px] min-w-[280px] shrink-0 flex-col rounded-lg bg-muted/30"
						>
							<div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
								<span
									className={cn("size-2 shrink-0 rounded-full", column.dot)}
								/>
								<span className="truncate text-[13px] font-medium">
									{column.name ?? <Trans>No label</Trans>}
								</span>
								<span className="text-xs tabular-nums text-muted-foreground">
									{items.length}
								</span>
							</div>
							<div className="flex min-h-[60px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
								{items.map((workspace) => (
									<V2WorkspacesBoardCard
										key={workspace.id}
										workspace={workspace}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

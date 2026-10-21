import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
	hasAllLabels,
	useLabelsByHost,
	type WorkspaceLabel,
	type WorkspaceLabelsState,
	workspaceLabels,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels";
import { useWorkspacesLabelViewStore } from "../../stores/workspacesLabelView";

interface WorkspacesLabelsValue {
	/** Every host's labels merged by name, in first-seen order. */
	labels: WorkspaceLabel[];
	labelsOf: (workspace: { id: string; hostId: string }) => WorkspaceLabel[];
	/** The picked label filters that still exist on some host. */
	activeFilters: string[];
}

const WorkspacesLabelsContext = createContext<WorkspacesLabelsValue>({
	labels: [],
	labelsOf: () => [],
	activeFilters: [],
});

export function WorkspacesLabelsProvider({
	hostIds,
	children,
}: {
	hostIds: string[];
	children: ReactNode;
}) {
	const labelsByHost = useLabelsByHost(hostIds, true);
	const labelFilters = useWorkspacesLabelViewStore(
		(state) => state.labelFilters,
	);
	const value = useMemo<WorkspacesLabelsValue>(() => {
		const byName = new Map<string, WorkspaceLabel>();
		for (const state of labelsByHost.values()) {
			for (const label of state.labels) {
				const key = label.name.toLowerCase();
				if (!byName.has(key)) byName.set(key, label);
			}
		}
		return {
			labels: [...byName.values()],
			labelsOf: (workspace) =>
				workspaceLabels(
					labelsByHost.get(workspace.hostId) as
						| WorkspaceLabelsState
						| undefined,
					workspace.id,
				),
			activeFilters: labelFilters.filter((name) =>
				byName.has(name.toLowerCase()),
			),
		};
	}, [labelsByHost, labelFilters]);
	return (
		<WorkspacesLabelsContext.Provider value={value}>
			{children}
		</WorkspacesLabelsContext.Provider>
	);
}

export function useWorkspacesLabels(): WorkspacesLabelsValue {
	return useContext(WorkspacesLabelsContext);
}

/** Keeps the workspaces that have every active label filter. */
export function useLabelFilteredWorkspaces<
	T extends { id: string; hostId: string },
>(workspaces: T[]): T[] {
	const { labelsOf, activeFilters } = useWorkspacesLabels();
	return useMemo(
		() =>
			activeFilters.length === 0
				? workspaces
				: workspaces.filter((workspace) =>
						hasAllLabels(labelsOf(workspace), activeFilters),
					),
		[workspaces, labelsOf, activeFilters],
	);
}

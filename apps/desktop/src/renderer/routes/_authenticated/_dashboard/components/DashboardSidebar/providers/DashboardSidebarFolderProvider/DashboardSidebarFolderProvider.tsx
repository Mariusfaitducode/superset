import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface DashboardSidebarFolder {
	projectId: string | null;
	groupId: string | null;
	/** The group's color, else the project's. */
	color: string | null;
}

const NO_FOLDER: DashboardSidebarFolder = {
	projectId: null,
	groupId: null,
	color: null,
};

const DashboardSidebarFolderContext =
	createContext<DashboardSidebarFolder>(NO_FOLDER);

export function DashboardSidebarFolderProvider({
	projectId,
	groupId,
	color,
	children,
}: DashboardSidebarFolder & { children: ReactNode }) {
	const value = useMemo(
		() => ({ projectId, groupId, color }),
		[projectId, groupId, color],
	);
	return (
		<DashboardSidebarFolderContext.Provider value={value}>
			{children}
		</DashboardSidebarFolderContext.Provider>
	);
}

export function useDashboardSidebarFolder(): DashboardSidebarFolder {
	return useContext(DashboardSidebarFolderContext);
}

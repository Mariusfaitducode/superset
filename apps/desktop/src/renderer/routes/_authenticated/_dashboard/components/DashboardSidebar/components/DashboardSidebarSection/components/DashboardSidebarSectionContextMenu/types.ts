export interface DashboardSidebarSectionActionsProps {
	color: string | null;
	/** Set to offer the group's sidebar options. */
	groupId?: string;
	onRename: () => void;
	onSetColor?: (color: string | null) => void;
	onDelete: () => void;
	/** Tag-backed folders only: hide the folder without untagging anyone. */
	onHide?: () => void;
}

export type SectionActionsMenuKind = "context" | "dropdown";

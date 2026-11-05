import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from "@superset/ui/context-menu";
import { SectionActionsMenuItems } from "./components/SectionActionsMenuItems";
import type { DashboardSidebarSectionActionsProps } from "./types";

interface DashboardSidebarSectionContextMenuProps
	extends DashboardSidebarSectionActionsProps {
	children: React.ReactNode;
}

export function DashboardSidebarSectionContextMenu({
	color,
	groupId,
	onRename,
	onSetColor,
	onDelete,
	onHide,
	children,
}: DashboardSidebarSectionContextMenuProps) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent
				onCloseAutoFocus={(event) => event.preventDefault()}
				onClick={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<SectionActionsMenuItems
					color={color}
					groupId={groupId}
					kind="context"
					onRename={onRename}
					onSetColor={onSetColor}
					onHide={onHide}
					onDelete={onDelete}
				/>
			</ContextMenuContent>
		</ContextMenu>
	);
}

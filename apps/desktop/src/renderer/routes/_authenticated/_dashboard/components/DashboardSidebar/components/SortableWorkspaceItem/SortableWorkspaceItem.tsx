import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@superset/ui/utils";
import { useMemo } from "react";
import { getBlockedDragProps } from "../../hooks/useBlockedDragNotice";
import { useDashboardSidebarDnd } from "../../hooks/useSidebarDnd";
import { DashboardSidebarFolderProvider } from "../../providers/DashboardSidebarFolderProvider";
import type { WorkspaceSelectionEvent } from "../../providers/DashboardSidebarSelectionProvider";
import type {
	DashboardSidebarWorkspace,
	DashboardSidebarWorkspaceIndentation,
} from "../../types";
import { DashboardSidebarWorkspaceItem } from "../DashboardSidebarWorkspaceItem";

interface SortableWorkspaceItemProps {
	sortableId: string;
	workspace: DashboardSidebarWorkspace;
	accentColor?: string | null;
	/** The group the row is filed under, if any. */
	groupId?: string | null;
	/** Fallback for the conversation stripe when the row has no group color. */
	projectColor?: string | null;
	isInSection?: boolean;
	indentation?: DashboardSidebarWorkspaceIndentation;
	onHoverCardOpen?: (workspaceId: string) => void | Promise<void>;
	shortcutLabel?: string;
	disabled?: boolean;
	/**
	 * Collapse the row to zero height (collapsed group) while keeping it
	 * mounted. Lives here — inside the sortable wrapper — so the clip box
	 * moves WITH the dnd translate; an outer overflow-hidden wrapper would
	 * clip displaced rows out of view mid-drag.
	 */
	collapsed?: boolean;
	/**
	 * The row belongs to the section being dragged: dim it like the dragged
	 * row itself, so the whole group reads as the in-list drop slot.
	 */
	isDragPlaceholder?: boolean;
	isSelected?: boolean;
	onSelectionClick?: (event: WorkspaceSelectionEvent) => boolean;
	/** Set for rows rendered inside the top-level Pinned section. */
	pinnedContext?: { projectName: string | null; projectIconUrl: string | null };
}

export function SortableWorkspaceItem({
	sortableId,
	workspace,
	accentColor,
	groupId = null,
	projectColor = null,
	isInSection,
	indentation,
	onHoverCardOpen,
	shortcutLabel,
	disabled,
	collapsed = false,
	isDragPlaceholder = false,
	isSelected = false,
	onSelectionClick,
	pinnedContext,
}: SortableWorkspaceItemProps) {
	const { isChildDragDisabled } = useDashboardSidebarDnd();
	const {
		setNodeRef,
		attributes,
		listeners,
		isDragging,
		transform,
		transition,
	} = useSortable({
		id: sortableId,
		disabled: disabled || isChildDragDisabled,
	});

	// useSortable re-renders this wrapper on every pointer move of any drag in
	// the sidebar's DndContext; the row body (query hooks, menus) is expensive,
	// so keep it referentially stable while only the wrapper transform changes.
	const row = useMemo(
		() => (
			<DashboardSidebarFolderProvider
				projectId={workspace.projectId}
				groupId={groupId}
				color={accentColor ?? projectColor}
			>
				<DashboardSidebarWorkspaceItem
					workspace={workspace}
					onHoverCardOpen={onHoverCardOpen}
					shortcutLabel={shortcutLabel}
					isInSection={isInSection}
					indentation={indentation}
					isSelected={isSelected}
					onSelectionClick={onSelectionClick}
					pinnedContext={pinnedContext}
				/>
			</DashboardSidebarFolderProvider>
		),
		[
			groupId,
			accentColor,
			projectColor,
			workspace,
			onHoverCardOpen,
			shortcutLabel,
			isInSection,
			indentation,
			isSelected,
			onSelectionClick,
			pinnedContext,
		],
	);

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Translate.toString(transform),
				transition,
				opacity: isDragging || isDragPlaceholder ? 0.5 : undefined,
				boxShadow: accentColor
					? `inset var(--sb-band) 0 ${accentColor}`
					: undefined,
			}}
			{...getBlockedDragProps(isChildDragDisabled)}
			{...attributes}
			{...listeners}
		>
			{/* Rows collapse via a CSS grid-row transition instead of a per-row
			    AnimatePresence/motion.div (~80 motion components cost real render
			    time). Collapsed rows stay mounted: `inert` removes them from
			    focus/hit-testing and the disabled sortable unregisters their
			    droppable, matching the old unmount behavior for DnD. */}
			<div
				className={cn(
					"grid transition-[grid-template-rows,opacity] duration-150 ease-out",
					collapsed
						? "grid-rows-[0fr] opacity-0"
						: "grid-rows-[1fr] opacity-100",
				)}
				inert={collapsed}
			>
				<div className="min-h-0 overflow-hidden">{row}</div>
			</div>
		</div>
	);
}

import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuStickyNote } from "react-icons/lu";
import {
	useIsWorkspaceNotesOpen,
	useWorkspaceNotesPanelStore,
} from "renderer/stores/workspace-notes-panel";
import { useWorkspaceNotes } from "./useWorkspaceNotes";

/**
 * The workspace's open notes on its row; opens the notes under it. With no
 * open note it only shows while the row is hovered, so a list can be started.
 */
export function WorkspaceNotesBadge({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const { t } = useLingui();
	const { notes, activeCount } = useWorkspaceNotes(workspaceId, hostId);
	const isOpen = useIsWorkspaceNotesOpen(workspaceId);
	if (notes === null) return null;

	return (
		<button
			type="button"
			aria-expanded={isOpen}
			aria-label={t`Notes: ${activeCount} open`}
			title={t`Notes: ${activeCount} open`}
			onClick={(event) => {
				event.stopPropagation();
				useWorkspaceNotesPanelStore.getState().toggle(workspaceId);
			}}
			onMouseDown={(event) => event.stopPropagation()}
			onTouchStart={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.stopPropagation();
				}
			}}
			className={cn(
				"flex h-4 shrink-0 items-center gap-0.5 rounded-sm px-0.5 text-[10px] tabular-nums text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
				isOpen && "text-foreground",
				activeCount === 0 &&
					!isOpen &&
					"hidden group-hover:flex group-focus-within:flex",
			)}
		>
			<LuStickyNote className="size-3" />
			{activeCount > 0 && <span>{activeCount}</span>}
		</button>
	);
}

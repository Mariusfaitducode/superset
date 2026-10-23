import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import type { SyntheticEvent } from "react";
import { LuArrowUpRight } from "react-icons/lu";
import {
	useIsWorkspaceNotesOpen,
	useWorkspaceNotesPanelStore,
} from "renderer/stores/workspace-notes-panel";
import type { DashboardSidebarWorkspaceIndentation } from "../../types";
import { NoteInput } from "./NoteInput";
import { NoteItem } from "./NoteItem";
import { isActiveNote } from "./notes";
import { useWorkspaceNotes } from "./useWorkspaceNotes";

function stopRowEvent(event: SyntheticEvent) {
	event.stopPropagation();
}

/**
 * A workspace's notes, under its row once opened from the row's badge.
 * Pasting several lines adds one note per line.
 */
export function WorkspaceNotesPanel({
	workspaceId,
	hostId,
	isInSection = false,
	indentation,
}: {
	workspaceId: string;
	hostId: string;
	isInSection?: boolean;
	indentation?: DashboardSidebarWorkspaceIndentation;
}) {
	const { t } = useLingui();
	const isOpen = useIsWorkspaceNotesOpen(workspaceId);
	const showAll = useWorkspaceNotesPanelStore((state) => state.showAll);
	const setShowAll = useWorkspaceNotesPanelStore((state) => state.setShowAll);
	const { notes, activeCount, actions } = useWorkspaceNotes(
		workspaceId,
		hostId,
	);
	const navigate = useNavigate();

	if (!isOpen || notes === null) return null;
	const shown = showAll ? notes : notes.filter(isActiveNote);

	const filterClass = (active: boolean) =>
		cn(
			"rounded-sm px-1 hover:text-foreground",
			active ? "bg-muted text-foreground" : "text-muted-foreground",
		);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: only keeps clicks and drags in the panel from activating or dragging the workspace row
		<div
			className={cn(
				"pr-2 pb-1",
				indentation === "top-level"
					? "pl-[22px]"
					: indentation === "grouped" || isInSection
						? "pl-[46px]"
						: "pl-[38px]",
			)}
			onMouseDown={stopRowEvent}
			onTouchStart={stopRowEvent}
			onClick={stopRowEvent}
			onDoubleClick={stopRowEvent}
			onKeyDown={stopRowEvent}
		>
			<div className="ml-[7px] border-l border-amber-500/40 pb-1 pl-2.5">
				<div className="flex h-5 items-center gap-1 text-[10px]">
					<span className="mr-auto font-medium text-muted-foreground">
						{t`Notes`}
					</span>
					<button
						type="button"
						aria-pressed={!showAll}
						onClick={() => setShowAll(false)}
						className={filterClass(!showAll)}
					>
						{t`Open ${activeCount}`}
					</button>
					<button
						type="button"
						aria-pressed={showAll}
						onClick={() => setShowAll(true)}
						className={filterClass(showAll)}
					>
						{t`All ${notes.length}`}
					</button>
					<button
						type="button"
						aria-label={t`Open in the Notes view`}
						title={t`Open in the Notes view`}
						onClick={() =>
							navigate({ to: "/notes", search: { workspace: workspaceId } })
						}
						className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<LuArrowUpRight className="size-3" />
					</button>
				</div>
				{shown.length > 0 && (
					<ul className="flex flex-col">
						{shown.map((note) => (
							<NoteItem key={note.id} note={note} actions={actions} />
						))}
					</ul>
				)}
				<div className="flex h-6 items-center">
					<NoteInput actions={actions} />
				</div>
			</div>
		</div>
	);
}

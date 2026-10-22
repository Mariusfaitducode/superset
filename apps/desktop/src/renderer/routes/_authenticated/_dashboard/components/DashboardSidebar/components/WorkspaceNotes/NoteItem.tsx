import { useLingui } from "@lingui/react/macro";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import type { IconType } from "react-icons";
import {
	LuAlignLeft,
	LuBan,
	LuBot,
	LuCircle,
	LuCircleCheck,
	LuEllipsis,
	LuStar,
} from "react-icons/lu";
import { NoteDetails } from "./NoteDetails";
import {
	NOTE_STATUSES,
	type NoteStatus,
	reportNoteError,
	type WorkspaceNote,
} from "./notes";
import type { NoteActions } from "./useWorkspaceNotes";

const STATUS_ICON: Record<NoteStatus, IconType> = {
	open: LuCircle,
	kept: LuStar,
	dropped: LuBan,
	done: LuCircleCheck,
};

const STATUS_CLASS: Record<NoteStatus, string> = {
	open: "text-muted-foreground",
	kept: "text-amber-500",
	dropped: "text-muted-foreground/60",
	done: "text-emerald-500",
};

/**
 * One note: its status menu, its text (click to edit), and a menu for the
 * details and deletion. The agent's own notes are marked. `large` is for
 * the Notes view, which also shows the details on the line.
 */
export function NoteItem({
	note,
	actions,
	large = false,
}: {
	note: WorkspaceNote;
	actions: NoteActions;
	large?: boolean;
}) {
	const { t } = useLingui();
	const [draft, setDraft] = useState<string | null>(null);
	const failed = t`Could not update the note`;
	const statusLabel: Record<NoteStatus, string> = {
		open: t({ message: "Open", context: "note status" }),
		kept: t`Kept`,
		dropped: t`Dropped`,
		done: t`Done`,
	};
	const StatusIcon = STATUS_ICON[note.status];
	const closed = note.status === "dropped" || note.status === "done";

	const commit = () => {
		const text = draft?.trim();
		setDraft(null);
		if (text && text !== note.text) {
			reportNoteError(actions.update(note.id, { text }), failed);
		}
	};

	return (
		<li
			className={cn(
				"group/note flex items-center gap-1.5 rounded-sm pr-1 hover:bg-muted/60",
				large ? "h-8 px-1.5" : "h-6",
			)}
		>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={t`Status: ${statusLabel[note.status]}`}
						title={statusLabel[note.status]}
						className={cn(
							"flex size-3.5 shrink-0 items-center justify-center rounded-sm hover:text-foreground",
							STATUS_CLASS[note.status],
						)}
					>
						<StatusIcon className="size-3" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="start" className="w-36">
					<DropdownMenuRadioGroup
						value={note.status}
						onValueChange={(value) =>
							reportNoteError(
								actions.setStatus(note.id, value as NoteStatus),
								failed,
							)
						}
					>
						{NOTE_STATUSES.map((status) => {
							const Icon = STATUS_ICON[status];
							return (
								<DropdownMenuRadioItem
									key={status}
									value={status}
									className="text-xs"
								>
									<Icon className={cn("size-3", STATUS_CLASS[status])} />
									{statusLabel[status]}
								</DropdownMenuRadioItem>
							);
						})}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{note.createdBy === "agent" && (
				<LuBot
					className="size-3 shrink-0 text-violet-500"
					aria-label={t`Added by an agent`}
				/>
			)}
			{draft !== null ? (
				<input
					// biome-ignore lint/a11y/noAutofocus: the user just asked to edit this item
					autoFocus
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.nativeEvent.isComposing)
							commit();
						if (event.key === "Escape") setDraft(null);
					}}
					className={cn(
						"min-w-0 flex-1 rounded-sm bg-background px-1 outline-none ring-1 ring-ring",
						large ? "h-6 text-sm" : "h-5 text-xs",
					)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setDraft(note.text)}
					title={note.details ? `${note.text}\n\n${note.details}` : note.text}
					className={cn(
						"min-w-0 flex-1 truncate text-left",
						large ? "text-sm" : "text-xs",
						closed && "text-muted-foreground line-through",
					)}
				>
					{note.text}
					{large && note.details && (
						<span className="ml-2 text-muted-foreground">{note.details}</span>
					)}
				</button>
			)}
			{!large && note.details && (
				<LuAlignLeft
					className="size-3 shrink-0 text-muted-foreground"
					aria-label={t`Has details`}
				/>
			)}
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label={t`Note details`}
						className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/note:opacity-100 data-[state=open]:opacity-100"
					>
						<LuEllipsis className="size-3" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" align="start" className="w-64 p-3">
					<NoteDetails
						note={note}
						onDetailsChange={(details) =>
							reportNoteError(actions.update(note.id, { details }), failed)
						}
						onDelete={() => reportNoteError(actions.remove(note.id), failed)}
					/>
				</PopoverContent>
			</Popover>
		</li>
	);
}

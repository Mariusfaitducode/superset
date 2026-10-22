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
	LuBan,
	LuBot,
	LuCircle,
	LuCircleCheck,
	LuEllipsis,
	LuStar,
	LuStickyNote,
} from "react-icons/lu";
import { IdeaDetails } from "./IdeaDetails";
import {
	IDEA_STATUSES,
	type IdeaStatus,
	reportIdeaError,
	type WorkspaceIdea,
} from "./ideas";
import type { IdeaActions } from "./useWorkspaceIdeas";

const STATUS_ICON: Record<IdeaStatus, IconType> = {
	open: LuCircle,
	kept: LuStar,
	dropped: LuBan,
	done: LuCircleCheck,
};

const STATUS_CLASS: Record<IdeaStatus, string> = {
	open: "text-muted-foreground",
	kept: "text-amber-500",
	dropped: "text-muted-foreground/60",
	done: "text-emerald-500",
};

/**
 * One idea: its status menu, its text (click to edit), and a menu for the
 * note and deletion. The agent's own ideas are marked.
 */
export function IdeaItem({
	idea,
	actions,
}: {
	idea: WorkspaceIdea;
	actions: IdeaActions;
}) {
	const { t } = useLingui();
	const [draft, setDraft] = useState<string | null>(null);
	const failed = t`Could not update the idea`;
	const statusLabel: Record<IdeaStatus, string> = {
		open: t({ message: "Open", context: "idea status" }),
		kept: t`Kept`,
		dropped: t`Dropped`,
		done: t`Done`,
	};
	const StatusIcon = STATUS_ICON[idea.status];
	const closed = idea.status === "dropped" || idea.status === "done";

	const commit = () => {
		const text = draft?.trim();
		setDraft(null);
		if (text && text !== idea.text) {
			reportIdeaError(actions.update(idea.id, { text }), failed);
		}
	};

	return (
		<li className="group/idea flex h-6 items-center gap-1.5 rounded-sm pr-1 hover:bg-muted/60">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={t`Status: ${statusLabel[idea.status]}`}
						title={statusLabel[idea.status]}
						className={cn(
							"flex size-3.5 shrink-0 items-center justify-center rounded-sm hover:text-foreground",
							STATUS_CLASS[idea.status],
						)}
					>
						<StatusIcon className="size-3" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="start" className="w-36">
					<DropdownMenuRadioGroup
						value={idea.status}
						onValueChange={(value) =>
							reportIdeaError(
								actions.setStatus(idea.id, value as IdeaStatus),
								failed,
							)
						}
					>
						{IDEA_STATUSES.map((status) => {
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
			{idea.createdBy === "agent" && (
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
					className="h-5 min-w-0 flex-1 rounded-sm bg-background px-1 text-xs outline-none ring-1 ring-ring"
				/>
			) : (
				<button
					type="button"
					onClick={() => setDraft(idea.text)}
					title={idea.note ? `${idea.text}\n\n${idea.note}` : idea.text}
					className={cn(
						"min-w-0 flex-1 truncate text-left text-xs",
						closed && "text-muted-foreground line-through",
					)}
				>
					{idea.text}
				</button>
			)}
			{idea.note && (
				<LuStickyNote
					className="size-3 shrink-0 text-muted-foreground"
					aria-label={t`Has a note`}
				/>
			)}
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label={t`Idea details`}
						className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/idea:opacity-100 data-[state=open]:opacity-100"
					>
						<LuEllipsis className="size-3" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" align="start" className="w-64 p-3">
					<IdeaDetails
						idea={idea}
						onNoteChange={(note) =>
							reportIdeaError(actions.update(idea.id, { note }), failed)
						}
						onDelete={() => reportIdeaError(actions.remove(idea.id), failed)}
					/>
				</PopoverContent>
			</Popover>
		</li>
	);
}

import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import {
	type ClipboardEvent,
	type KeyboardEvent,
	type SyntheticEvent,
	useState,
} from "react";
import {
	useIsWorkspaceIdeasOpen,
	useWorkspaceIdeasPanelStore,
} from "renderer/stores/workspace-ideas-panel";
import type { DashboardSidebarWorkspaceIndentation } from "../../types";
import { IdeaItem } from "./IdeaItem";
import { isActiveIdea, parseIdeaLines, reportIdeaError } from "./ideas";
import { useWorkspaceIdeas } from "./useWorkspaceIdeas";

function stopRowEvent(event: SyntheticEvent) {
	event.stopPropagation();
}

/**
 * A workspace's ideas, under its row once opened from the row's badge.
 * Pasting several lines adds one idea per line.
 */
export function WorkspaceIdeasPanel({
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
	const isOpen = useIsWorkspaceIdeasOpen(workspaceId);
	const showAll = useWorkspaceIdeasPanelStore((state) => state.showAll);
	const setShowAll = useWorkspaceIdeasPanelStore((state) => state.setShowAll);
	const { ideas, activeCount, actions } = useWorkspaceIdeas(
		workspaceId,
		hostId,
	);
	const [text, setText] = useState("");
	const failed = t`Could not add the ideas`;

	if (!isOpen || ideas === null) return null;
	const shown = showAll ? ideas : ideas.filter(isActiveIdea);

	const add = (texts: string[]) => {
		if (texts.length > 0) reportIdeaError(actions.add(texts), failed);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		add(parseIdeaLines(text));
		setText("");
	};

	const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
		const pasted = event.clipboardData.getData("text/plain");
		if (!/\r?\n/.test(pasted.trim())) return;
		event.preventDefault();
		add(parseIdeaLines(`${text}\n${pasted}`));
		setText("");
	};

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
						{t`Ideas`}
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
						{t`All ${ideas.length}`}
					</button>
				</div>
				{shown.length > 0 && (
					<ul className="flex flex-col">
						{shown.map((idea) => (
							<IdeaItem key={idea.id} idea={idea} actions={actions} />
						))}
					</ul>
				)}
				<div className="flex h-6 items-center">
					<input
						value={text}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={onKeyDown}
						onPaste={onPaste}
						placeholder={t`Add or paste ideas…`}
						title={t`Pasting several lines adds one idea per line`}
						className="h-5 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring"
					/>
				</div>
			</div>
		</div>
	);
}

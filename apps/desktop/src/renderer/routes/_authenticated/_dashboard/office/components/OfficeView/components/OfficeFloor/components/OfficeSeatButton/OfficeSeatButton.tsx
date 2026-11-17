import { Trans } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from "react";
import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";
import {
	ERROR_GLYPH,
	ERROR_GLYPH_CLASS,
	TONE_GLYPH,
	TONE_GLYPH_CLASS,
} from "../../toneStyles";

/** Filled bubbles call for you; parked ones fade. */
const BUBBLE_CLASS: Record<OfficeTone, string> = {
	waiting: "bg-amber-400 text-[#1d1a24]",
	check: "bg-violet-300 text-[#1d1a24]",
	working: "bg-[#f4f1ea] text-[#1d1a24]",
	todos: "bg-sky-300 text-[#1d1a24]",
	resume: "bg-[#f4f1ea]/75 text-[#1d1a24]/70",
	done: "bg-green-500 text-[#1d1a24]",
};

/**
 * One agent: its bubble (state and current task) above the canvas-drawn
 * character and desk. Click opens the conversation; alt-click, right-click
 * or `i` opens the details panel.
 */
export function OfficeSeatButton({
	buttonRef,
	tone,
	failed = false,
	pinned = false,
	title,
	toneLabel,
	stateLabel,
	workspaceName,
	topTodo,
	selected,
	style,
	bubbleHeight,
	onOpen,
	onDetails,
	onKeyDown,
	onFocus,
}: {
	buttonRef?: Ref<HTMLButtonElement>;
	tone: OfficeTone;
	/** Waiting because it stopped on an error. */
	failed?: boolean;
	/** The user set the state by hand. */
	pinned?: boolean;
	title: string;
	toneLabel: string;
	stateLabel: string;
	workspaceName: string;
	topTodo: string | null;
	selected: boolean;
	style: CSSProperties;
	/** CSS pixels; the bubble sits in the tile above the agent's head. */
	bubbleHeight: number;
	onOpen: () => void;
	onDetails: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
	/** Lets the office pan to a seat reached with the keyboard. */
	onFocus?: () => void;
}) {
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (event.altKey) onDetails();
		else onOpen();
	};
	const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		onDetails();
	};

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					ref={buttonRef}
					type="button"
					onClick={handleClick}
					onContextMenu={handleContextMenu}
					onKeyDown={onKeyDown}
					onFocus={onFocus}
					aria-label={`${title} · ${toneLabel} · ${workspaceName}`}
					style={style}
					className={cn(
						"absolute flex flex-col items-stretch rounded-sm text-left outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring",
						selected && "ring-2 ring-yellow-300",
					)}
				>
					<span
						className={cn(
							"relative flex min-w-0 items-center gap-1 border-2 border-[#1d1a24] px-0.5 font-mono text-[10px] leading-none shadow-[2px_2px_0_rgba(29,26,36,0.45)]",
							failed ? "bg-red-500 text-white" : BUBBLE_CLASS[tone],
						)}
						style={{ height: bubbleHeight }}
					>
						<span
							aria-hidden
							className={cn(
								"flex size-3 shrink-0 items-center justify-center font-bold",
								failed ? ERROR_GLYPH_CLASS : TONE_GLYPH_CLASS[tone],
								tone === "waiting" && "motion-safe:animate-pulse",
							)}
						>
							{failed ? ERROR_GLYPH : TONE_GLYPH[tone]}
						</span>
						<span className="min-w-0 flex-1 truncate">{title}</span>
						{pinned && (
							<span aria-hidden className="shrink-0 opacity-60">
								•
							</span>
						)}
					</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-72">
				<p className="font-medium">{title}</p>
				<p className="font-medium">{toneLabel}</p>
				<p className="opacity-70">
					{stateLabel} · {workspaceName}
				</p>
				{topTodo && <p className="mt-1 line-clamp-2">☐ {topTodo}</p>}
				<p className="mt-1 opacity-60">
					<Trans>Click to open · ⌥-click or I for details</Trans>
				</p>
			</TooltipContent>
		</Tooltip>
	);
}

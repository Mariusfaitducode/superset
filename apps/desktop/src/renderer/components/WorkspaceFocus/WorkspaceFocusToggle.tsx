import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { SyntheticEvent } from "react";
import { LuTarget } from "react-icons/lu";
import { HotkeyLabel } from "renderer/hotkeys";
import {
	useIsWorkspaceFocused,
	useWorkspaceFocusStore,
} from "renderer/stores/workspace-focus";
import { FOCUS_TEXT_CLASS } from "./styles";

function stop(event: SyntheticEvent) {
	event.stopPropagation();
}

/**
 * The focus mark of a workspace, and the one-click toggle for it. It sits on
 * rows and cards that open the workspace on click, so it keeps its events.
 */
export function WorkspaceFocusToggle({
	workspaceId,
	showHotkey = false,
	className,
	idleClassName,
	iconClassName = "size-3.5",
}: {
	workspaceId: string;
	/** Shows the shortcut in the tooltip: only for the workspace on screen. */
	showHotkey?: boolean;
	className?: string;
	/** Applied while not in focus, e.g. to show it on hover only. */
	idleClassName?: string;
	iconClassName?: string;
}) {
	const { t } = useLingui();
	const focused = useIsWorkspaceFocused(workspaceId);
	const toggle = useWorkspaceFocusStore((state) => state.toggle);
	const label = focused ? t`Remove from focus` : t`Add to focus`;

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					aria-pressed={focused}
					onClick={(event) => {
						event.stopPropagation();
						event.preventDefault();
						toggle(workspaceId);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") stop(event);
					}}
					onPointerDown={stop}
					onMouseDown={stop}
					onDoubleClick={stop}
					className={cn(
						"flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-foreground/10",
						focused
							? FOCUS_TEXT_CLASS
							: cn(
									"text-muted-foreground hover:text-foreground",
									idleClassName,
								),
						className,
					)}
				>
					<LuTarget className={iconClassName} strokeWidth={focused ? 2.5 : 2} />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">
				<HotkeyLabel
					label={label}
					id={showHotkey ? "TOGGLE_WORKSPACE_FOCUS" : undefined}
				/>
			</TooltipContent>
		</Tooltip>
	);
}

/** The focus mark alone, where the workspace can't be toggled in place. */
export function WorkspaceFocusMark({
	workspaceId,
	className = "size-3",
}: {
	workspaceId: string;
	className?: string;
}) {
	const { t } = useLingui();
	const focused = useIsWorkspaceFocused(workspaceId);
	if (!focused) return null;
	return (
		<LuTarget
			role="img"
			aria-label={t`In focus`}
			strokeWidth={2.5}
			className={cn("shrink-0", FOCUS_TEXT_CLASS, className)}
		/>
	);
}

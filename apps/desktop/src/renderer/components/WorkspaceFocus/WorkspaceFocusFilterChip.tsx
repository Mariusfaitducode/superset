import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { LuTarget } from "react-icons/lu";
import { useWorkspaceFocusStore } from "renderer/stores/workspace-focus";
import { FOCUS_TEXT_CLASS } from "./styles";

const SIZE_CLASS = {
	sm: "h-5 gap-1 rounded-full px-1.5 text-[11px]",
	md: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
} as const;

/**
 * "Focus only": one switch shared by every view, so turning it on in the
 * sidebar also narrows the Office, Hosts, Workspaces and Needs you pages.
 */
export function WorkspaceFocusFilterChip({
	size = "sm",
	className,
}: {
	size?: keyof typeof SIZE_CLASS;
	className?: string;
}) {
	const { t } = useLingui();
	const count = useWorkspaceFocusStore((state) => state.ids.length);
	const focusOnly = useWorkspaceFocusStore((state) => state.focusOnly);
	const setFocusOnly = useWorkspaceFocusStore((state) => state.setFocusOnly);
	const isOn = focusOnly && count > 0;
	const hint =
		count === 0
			? t`No workspace in focus yet: click the target on a workspace to add it`
			: isOn
				? t`Showing only the workspaces in focus. Click to show all.`
				: t`Show only the workspaces in focus`;

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-pressed={isOn}
					aria-disabled={count === 0}
					onClick={() => {
						if (count > 0) setFocusOnly(!isOn);
					}}
					className={cn(
						"flex shrink-0 items-center border transition-colors",
						SIZE_CLASS[size],
						isOn
							? "border-[color:var(--focus-mark)]/60 bg-accent text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
						count === 0 &&
							"cursor-default opacity-60 hover:text-muted-foreground",
						className,
					)}
				>
					<LuTarget
						className={cn(
							size === "sm" ? "size-3" : "size-3.5",
							count > 0 && FOCUS_TEXT_CLASS,
						)}
					/>
					{t({ message: "Focus", context: "workspace focus filter" })}
					{count > 0 && (
						<span className="tabular-nums opacity-70">{count}</span>
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{hint}</TooltipContent>
		</Tooltip>
	);
}

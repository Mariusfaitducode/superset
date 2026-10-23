import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LuInbox } from "react-icons/lu";
import { useDeskQueue } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

/** The Desk entry of the sidebar, with the count of what waits on the user. */
export function DeskNavButton({ isCollapsed }: { isCollapsed: boolean }) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const isOpen = !!matchRoute({ to: "/desk", fuzzy: true });
	const count = useDeskQueue().length;
	const label = count > 0 ? t`Desk, ${count} waiting on you` : t`Desk`;
	const badge = count > 99 ? "99+" : String(count);
	const open = () => navigate({ to: "/desk" });

	if (isCollapsed) {
		return (
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={open}
						aria-label={label}
						aria-current={isOpen ? "page" : undefined}
						className={cn(
							"relative flex size-7 items-center justify-center rounded-md transition-colors",
							isOpen
								? "bg-fill-selected text-muted-foreground"
								: "text-muted-foreground hover:bg-fill-hover",
						)}
					>
						<LuInbox className="size-3.5" strokeWidth={1.5} />
						{count > 0 && (
							<span
								aria-hidden="true"
								className="absolute right-1 top-1 size-1.5 rounded-full bg-violet-500"
							/>
						)}
					</button>
				</TooltipTrigger>
				<TooltipContent side="right">{label}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<button
			type="button"
			onClick={open}
			aria-label={label}
			aria-current={isOpen ? "page" : undefined}
			className={cn(
				"flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors",
				isOpen
					? "bg-fill-selected text-foreground"
					: "text-muted-foreground hover:bg-fill-hover hover:text-foreground",
			)}
		>
			<LuInbox
				className="size-4 shrink-0 text-muted-foreground"
				strokeWidth={1.5}
			/>
			<span className="flex-1 text-left">{t`Desk`}</span>
			{count > 0 && (
				<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500/15 px-1 text-[10px] font-medium tabular-nums text-violet-600 dark:text-violet-400">
					{badge}
				</span>
			)}
		</button>
	);
}

import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useMemo } from "react";
import { LuActivity, LuCircleAlert } from "react-icons/lu";
import { useTrackedTasks } from "../../hooks/useTrackedTasks";
import { useTaskMonitorStore } from "../../stores/task-monitor";
import { summarizeTasks } from "../../utils/task-monitor";
import { ProgressRing } from "./ProgressRing";

/**
 * Opens the task monitor. Shows how many tracked tasks run and how far they
 * are overall; turns red while a failed task waits to be closed.
 */
export function TaskMonitorButton({ className }: { className?: string }) {
	const { t } = useLingui();
	const { tasks } = useTrackedTasks();
	const isOpen = useTaskMonitorStore((state) => state.isOpen);
	const toggle = useTaskMonitorStore((state) => state.toggle);
	const summary = useMemo(() => summarizeTasks(tasks), [tasks]);
	const hasFailed = summary.failed > 0;

	const label = hasFailed
		? t`${summary.failed} failed, ${summary.running} running`
		: summary.running > 0
			? t`${summary.running} running`
			: t`Tracked tasks`;

	return (
		<Tooltip delayDuration={500}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					aria-expanded={isOpen}
					// The panel closes on outside clicks; this one must toggle it.
					data-task-monitor-toggle=""
					onClick={toggle}
					className={cn(
						"no-drag flex h-6 shrink-0 items-center gap-1.5 rounded border px-1.5 text-xs font-medium tabular-nums",
						"transition-colors duration-150 ease-out",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						hasFailed
							? "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/15"
							: "border-border/60 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
						isOpen &&
							!hasFailed &&
							"border-border bg-secondary text-foreground",
						className,
					)}
				>
					{summary.running > 0 ? (
						<ProgressRing
							progress={summary.progress}
							className={hasFailed ? undefined : "text-primary"}
						/>
					) : hasFailed ? (
						<LuCircleAlert className="size-3.5 shrink-0" />
					) : (
						<LuActivity className="size-3.5 shrink-0" />
					)}
					{summary.running > 0 ? (
						<span>{summary.running}</span>
					) : (
						hasFailed && <span>{summary.failed}</span>
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

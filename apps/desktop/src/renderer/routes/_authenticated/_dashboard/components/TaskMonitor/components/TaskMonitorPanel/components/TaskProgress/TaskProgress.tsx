import { cn } from "@superset/ui/utils";
import type { TaskProgress as Progress } from "../../../../utils/task-monitor";
import "./task-progress.css";

const TONE = {
	running: "text-primary",
	done: "text-emerald-500",
	failed: "text-red-500",
} as const;

/**
 * Steps as segments, CI jobs and percentages as one bar, and a sweep when
 * the task reports nothing measurable.
 */
export function TaskProgress({
	progress,
	status,
}: {
	progress: Progress;
	status: keyof typeof TONE;
}) {
	const tone = TONE[status];
	if (progress.kind === "steps") {
		return (
			<div className={cn("flex h-1 gap-0.5", tone)} aria-hidden="true">
				{Array.from({ length: progress.total }, (_, index) => {
					const done = index < progress.done;
					const current = index === progress.done && status !== "done";
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
							key={index}
							className={cn(
								"h-full flex-1 rounded-full",
								done
									? "bg-current"
									: current
										? status === "failed"
											? "bg-current"
											: "task-progress-current bg-current"
										: "bg-muted-foreground/15",
							)}
						/>
					);
				})}
			</div>
		);
	}
	const fraction =
		progress.kind === "percent"
			? progress.value / 100
			: progress.kind === "jobs" && progress.total > 0
				? progress.done / progress.total
				: null;
	return (
		<div
			className={cn(
				"relative h-1 overflow-hidden rounded-full bg-muted-foreground/15",
				tone,
			)}
			aria-hidden="true"
		>
			{fraction === null ? (
				status === "running" ? (
					<span className="task-progress-sweep" />
				) : (
					<span className="absolute inset-0 rounded-full bg-current" />
				)
			) : (
				<span
					className="absolute inset-y-0 left-0 rounded-full bg-current transition-[width] duration-500 ease-out"
					style={{ width: `${Math.round(fraction * 100)}%` }}
				/>
			)}
		</div>
	);
}

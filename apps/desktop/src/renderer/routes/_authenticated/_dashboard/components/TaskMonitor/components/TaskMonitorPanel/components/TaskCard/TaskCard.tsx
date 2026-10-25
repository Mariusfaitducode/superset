import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import {
	LuArchiveRestore,
	LuCheck,
	LuCircleAlert,
	LuExternalLink,
	LuX,
} from "react-icons/lu";
import {
	formatElapsed,
	type MonitoredTask,
	taskProgress,
} from "../../../../utils/task-monitor";
import { TaskProgress } from "../TaskProgress";

type Silence = NonNullable<MonitoredTask["silence"]>;

function linkLabel(link: string): string {
	try {
		const url = new URL(link);
		const path = url.pathname.replace(/\/$/, "");
		const short = path.split("/").slice(-2).join("/");
		return short ? `${url.hostname}/…/${short}` : url.hostname;
	} catch {
		return link;
	}
}

/**
 * One tracked task: where it runs, how far it is, the last news. Clicking
 * it opens the conversation; closing a finished one archives it.
 */
export function TaskCard({
	task,
	workspaceName,
	conversationTitle,
	now,
	onOpen,
	onArchive,
	onRestore,
}: {
	task: MonitoredTask;
	workspaceName: string | null;
	conversationTitle: string | null;
	now: number;
	onOpen: () => void;
	onArchive?: () => void;
	onRestore?: () => void;
}) {
	const { t } = useLingui();
	const progress = taskProgress(task);
	const elapsed = formatElapsed((task.endedAt ?? now) - task.createdAt);
	const lastNote = task.notes.at(-1)?.text ?? null;
	const silenceLabel: Record<Silence, string> = {
		"no-news": t`No news for ${formatElapsed(now - task.updatedAt)}`,
		"agent-gone": t`The agent's session ended`,
		"agent-idle": t`The agent stopped working`,
		"agent-blocked": t`The agent waits for a permission`,
		"ci-unreachable": t`GitHub stopped answering`,
	};
	const progressText =
		progress.kind === "steps"
			? `${Math.min(progress.done + (task.status === "running" ? 1 : 0), progress.total)}/${progress.total}`
			: progress.kind === "jobs"
				? t`${progress.done}/${progress.total} jobs`
				: progress.kind === "percent"
					? `${progress.value}%`
					: null;
	const place = [workspaceName, conversationTitle].filter(Boolean).join(" / ");

	return (
		<article
			className={cn(
				"group/card relative rounded-lg border bg-card p-3 text-card-foreground transition-colors",
				"hover:border-border hover:bg-accent/30",
				task.status === "failed" ? "border-red-500/30" : "border-border/60",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				aria-label={t`Open the conversation of ${task.title}`}
				className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			/>
			<div className="pointer-events-none relative flex flex-col gap-2">
				<div className="flex items-start gap-2">
					{task.status === "done" && (
						<LuCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
					)}
					{task.status === "failed" && (
						<LuCircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-500" />
					)}
					<div className="min-w-0 flex-1">
						<p
							className="truncate text-sm font-medium leading-5"
							title={task.title}
						>
							{task.title}
						</p>
						{place && (
							<p
								className="truncate text-[11px] text-muted-foreground"
								title={place}
							>
								{place}
							</p>
						)}
					</div>
					<span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground tabular-nums">
						{elapsed}
					</span>
					{onArchive && task.status !== "running" && (
						<button
							type="button"
							onClick={onArchive}
							aria-label={t`Close and archive`}
							title={t`Close and archive`}
							className="pointer-events-auto -mr-1 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<LuX className="size-3.5" />
						</button>
					)}
					{onRestore && (
						<button
							type="button"
							onClick={onRestore}
							aria-label={t`Restore`}
							title={t`Restore`}
							className="pointer-events-auto -mr-1 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<LuArchiveRestore className="size-3.5" />
						</button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<div className="min-w-0 flex-1">
						<TaskProgress progress={progress} status={task.status} />
					</div>
					{progressText && (
						<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
							{progressText}
						</span>
					)}
				</div>

				{task.steps.length > 0 && (
					<ol className="flex flex-col gap-0.5 text-[11px]">
						{task.steps.map((step, index) => {
							const done =
								task.status === "done" || index < (task.currentStep ?? 0);
							const current =
								task.status !== "done" && index === (task.currentStep ?? 0);
							return (
								<li
									// biome-ignore lint/suspicious/noArrayIndexKey: steps may repeat a name
									key={index}
									className={cn(
										"flex items-center gap-1.5",
										done && "text-muted-foreground",
										current && "font-medium text-foreground",
										!done && !current && "text-muted-foreground/70",
									)}
								>
									<span className="flex size-3 shrink-0 items-center justify-center">
										{done ? (
											<LuCheck className="size-3" />
										) : (
											<span
												className={cn(
													"size-1.5 rounded-full",
													current
														? task.status === "failed"
															? "bg-red-500"
															: "bg-primary"
														: "border border-current",
												)}
											/>
										)}
									</span>
									<span className="truncate">{step}</span>
								</li>
							);
						})}
					</ol>
				)}

				{task.ci?.currentJob && task.status === "running" && (
					<p className="truncate text-[11px] text-muted-foreground">
						{t`Running ${task.ci.currentJob}`}
					</p>
				)}

				{task.status === "failed" && task.failReason ? (
					<p className="line-clamp-2 text-xs text-red-500">{task.failReason}</p>
				) : (
					lastNote && (
						<p className="line-clamp-2 text-xs text-muted-foreground">
							{lastNote}
						</p>
					)
				)}

				{(task.silence || task.link) && (
					<div className="flex items-center gap-2">
						{task.silence && (
							<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400">
								<span className="size-1 rounded-full bg-current" />
								{t`Silent`}
							</span>
						)}
						{task.silence && (
							<span className="min-w-0 truncate text-[11px] text-muted-foreground">
								{silenceLabel[task.silence]}
							</span>
						)}
						{task.link && (
							<a
								href={task.ci?.runUrl ?? task.link}
								target="_blank"
								rel="noreferrer noopener"
								title={task.link}
								className="pointer-events-auto ml-auto inline-flex min-w-0 items-center gap-1 rounded-sm text-[11px] text-muted-foreground hover:text-foreground"
							>
								<span className="truncate">{linkLabel(task.link)}</span>
								<LuExternalLink className="size-3 shrink-0" />
							</a>
						)}
					</div>
				)}
			</div>
		</article>
	);
}

import { Trans, useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useEffect, useState } from "react";
import { LuPower, LuRotateCcw } from "react-icons/lu";
import {
	PINNABLE_WORK_STATES,
	type PinnableWorkState,
	type WorkStateInfo,
	workStateColorVar,
} from "renderer/lib/agent-state";
import { useWorkStateLabels } from "./useWorkStateLabels";
import { WORK_STATE_ICON, WorkStateIcon } from "./WorkStateIcon";

const CONFIRM_MS = 4_000;

/**
 * A conversation's state and one click to correct it: the current state on
 * top (pinned or inferred, and why), the four states below. Clicking the
 * pinned one again, or "Automatic", hands it back to the inference.
 */
export function WorkStatePicker({
	info,
	canPin,
	onPin,
	onUnpin,
	onCloseAgent,
	compact = false,
	className,
}: {
	info: WorkStateInfo | undefined;
	/** False on hosts too old to keep pinned states. */
	canPin: boolean;
	onPin: (state: PinnableWorkState) => void;
	onUnpin: () => void;
	/** Offered once the conversation is done. */
	onCloseAgent?: () => void;
	compact?: boolean;
	className?: string;
}) {
	const { t } = useLingui();
	const words = useWorkStateLabels();
	const [confirmClose, setConfirmClose] = useState(false);
	useEffect(() => {
		if (!confirmClose) return;
		const timer = setTimeout(() => setConfirmClose(false), CONFIRM_MS);
		return () => clearTimeout(timer);
	}, [confirmClose]);

	if (!info) return null;
	const pinned = info.mark;
	const color = workStateColorVar(info);
	const now = Date.now();
	const why = pinned
		? pinned.setBy === "user"
			? t`Set by you · ${formatCompactRelativeTime(Math.min(pinned.setAt, now), now)}`
			: t`Set by the agent · ${formatCompactRelativeTime(Math.min(pinned.setAt, now), now)}`
		: words.cause[info.cause];
	const inferredNote =
		pinned && info.inferred.state !== pinned.state
			? t`Automatic would say: ${words.label[info.inferred.state]}`
			: null;

	return (
		<section
			aria-label={t`Conversation state`}
			className={cn(
				"rounded-md border border-border bg-muted/30",
				compact ? "p-1.5" : "p-2",
				className,
			)}
			style={{ boxShadow: `inset 3px 0 ${color}` }}
		>
			<div className="flex min-w-0 items-start gap-2 pl-1">
				<span
					className={cn(
						"flex shrink-0 items-center justify-center rounded-md",
						compact ? "size-6" : "size-7",
					)}
					style={{
						backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
					}}
				>
					<WorkStateIcon
						state={info.state}
						cause={info.cause}
						className={compact ? "size-3.5" : "size-4"}
					/>
				</span>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							"truncate font-medium leading-tight",
							compact ? "text-xs" : "text-sm",
						)}
					>
						{words.label[info.state]}
					</p>
					<p className="truncate text-[11px] leading-tight text-muted-foreground">
						{pinned ? (
							<span>{why}</span>
						) : (
							<>
								<span className="font-medium">
									<Trans>Automatic</Trans>
								</span>
								{" · "}
								{why}
							</>
						)}
					</p>
					{inferredNote && !compact && (
						<p className="truncate text-[11px] leading-tight text-muted-foreground/80">
							{inferredNote}
						</p>
					)}
				</div>
				{pinned && canPin && (
					<button
						type="button"
						onClick={onUnpin}
						title={t`Let the app infer the state again`}
						className="flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<LuRotateCcw className="size-3" />
						<Trans>Automatic</Trans>
					</button>
				)}
			</div>
			{canPin ? (
				<fieldset
					aria-label={t`Set the state`}
					className={cn("grid grid-cols-4 gap-1", compact ? "mt-1.5" : "mt-2")}
				>
					{PINNABLE_WORK_STATES.map((state) => {
						const Icon = WORK_STATE_ICON[state];
						const isPinned = pinned?.state === state;
						const isInferred = !pinned && info.state === state;
						const stateColor = workStateColorVar({ state, cause: "pinned" });
						return (
							<Tooltip key={state} delayDuration={400}>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-pressed={isPinned}
										onClick={() => (isPinned ? onUnpin() : onPin(state))}
										className={cn(
											"flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
											compact ? "h-9" : "h-11",
											isPinned
												? "border-transparent font-medium text-foreground"
												: isInferred
													? "border-dashed text-foreground"
													: "border-transparent text-muted-foreground hover:bg-background hover:text-foreground",
										)}
										style={
											isPinned
												? {
														backgroundColor: `color-mix(in oklab, ${stateColor} 22%, transparent)`,
													}
												: isInferred
													? { borderColor: stateColor }
													: undefined
										}
									>
										<Icon
											aria-hidden
											className="size-3.5"
											style={{ color: stateColor }}
										/>
										<span className="max-w-full truncate px-0.5">
											{words.short[state]}
										</span>
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-60">
									<p className="font-medium">{words.label[state]}</p>
									<p className="opacity-80">{words.hint[state]}</p>
									<p className="mt-1 opacity-60">
										{isPinned ? (
											<Trans>Click again to go back to automatic.</Trans>
										) : (
											<Trans>Kept until you prompt the agent again.</Trans>
										)}
									</p>
								</TooltipContent>
							</Tooltip>
						);
					})}
				</fieldset>
			) : (
				<p className="mt-1.5 pl-1 text-[11px] text-muted-foreground">
					<Trans>Update this host to set the state by hand.</Trans>
				</p>
			)}
			{info.state === "done" && onCloseAgent && (
				<button
					type="button"
					onClick={() => {
						if (confirmClose) {
							setConfirmClose(false);
							onCloseAgent();
						} else {
							setConfirmClose(true);
						}
					}}
					className={cn(
						"mt-1.5 flex h-7 w-full items-center justify-center gap-1.5 rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						confirmClose
							? "border-[color:var(--sb-state-unseen)] bg-[color:var(--sb-state-unseen)]/15 font-medium text-foreground"
							: "border-border text-muted-foreground hover:bg-background hover:text-foreground",
					)}
				>
					<LuPower className="size-3.5" />
					{confirmClose ? (
						<Trans>Click again to close the agent</Trans>
					) : (
						<Trans>Close the agent</Trans>
					)}
				</button>
			)}
		</section>
	);
}

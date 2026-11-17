import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuScanEye } from "react-icons/lu";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import type {
	ObserverRun,
	ObserverStatus,
} from "renderer/routes/_authenticated/_dashboard/office/utils/observerStatus";

/**
 * The observer's booth, pinned to the office's corner rather than placed
 * among the desks: it watches the floor, it doesn't work on it.
 */
export function OfficeObserverDesk({
	status,
	synthesis,
	selected,
	onOpen,
}: {
	status: ObserverStatus;
	synthesis: ObserverRun | null;
	selected: boolean;
	onOpen: () => void;
}) {
	const { t } = useLingui();
	const findings = synthesis?.synthesis?.findings ?? [];
	const urgent = findings.filter((finding) => finding.priority === "high");
	const busy = status.kind === "starting" || status.kind === "running";

	return (
		<button
			type="button"
			onClick={onOpen}
			aria-pressed={selected}
			aria-label={t`Observer`}
			className={cn(
				"absolute top-3 left-3 z-10 flex w-64 flex-col gap-1 border-2 border-[#1d1a24] bg-[#2b2347] p-2 text-left font-mono text-[#f4f1ea] shadow-[3px_3px_0_rgba(29,26,36,0.6)] outline-none hover:bg-[#352b58] focus-visible:ring-2 focus-visible:ring-ring",
				selected && "ring-2 ring-indigo-300",
			)}
		>
			<span className="flex items-center gap-1.5">
				<span
					className={cn(
						"flex size-6 shrink-0 items-center justify-center border-2 border-[#1d1a24] bg-indigo-300 text-[#1d1a24]",
						busy && "motion-safe:animate-pulse",
					)}
				>
					<LuScanEye aria-hidden className="size-3.5" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-xs font-bold leading-tight">
						<Trans>Observer</Trans>
					</span>
					<span className="block truncate text-[10px] leading-tight opacity-75">
						<ObserverStatusLine status={status} />
					</span>
				</span>
				{urgent.length > 0 && (
					<span
						title={t`For today`}
						className="shrink-0 border border-[#1d1a24] bg-amber-400 px-1 text-[10px] font-bold text-[#1d1a24]"
					>
						{urgent.length}
					</span>
				)}
			</span>
			{synthesis?.synthesis ? (
				<span className="line-clamp-2 text-[10px] leading-snug opacity-90">
					{synthesis.synthesis.headline}
				</span>
			) : (
				<span className="text-[10px] leading-snug opacity-70">
					<Trans>
						Watches every agent and tells you what to improve and what waits on
						you.
					</Trans>
				</span>
			)}
		</button>
	);
}

export function ObserverStatusLine({ status }: { status: ObserverStatus }) {
	switch (status.kind) {
		case "never":
			return <Trans>Never run</Trans>;
		case "starting":
			return <Trans>Starting…</Trans>;
		case "running": {
			const ago = formatRelativeTime(status.run.startedAt);
			return <Trans>Observing, started {ago} ago</Trans>;
		}
		case "stalled": {
			const ago = formatRelativeTime(status.run.startedAt);
			return <Trans>Started {ago} ago, never published</Trans>;
		}
		case "idle": {
			const ago = formatRelativeTime(
				status.run.finishedAt ?? status.run.startedAt,
			);
			return <Trans>Last run {ago} ago</Trans>;
		}
	}
}

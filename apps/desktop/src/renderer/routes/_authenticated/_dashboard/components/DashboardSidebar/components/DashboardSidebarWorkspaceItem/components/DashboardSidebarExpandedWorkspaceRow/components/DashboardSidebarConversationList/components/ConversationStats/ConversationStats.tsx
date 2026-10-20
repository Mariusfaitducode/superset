import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@superset/ui/hover-card";
import { cn } from "@superset/ui/utils";
import type { SyntheticEvent } from "react";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { useConversationStats } from "../../hooks/useConversationStats";

function stopEvent(event: SyntheticEvent) {
	event.stopPropagation();
}

function usageClass(share: number | null): string {
	if (share === null || share < 0.7) return "text-muted-foreground";
	return share < 0.9 ? "text-amber-500" : "text-red-500";
}

export function ConversationStats({
	workspaceId,
	hostId,
	terminalId,
	lastEventAt,
}: {
	workspaceId: string;
	hostId: string;
	terminalId: string;
	lastEventAt: number;
}) {
	const { t } = useLingui();
	const {
		formatNumber,
		formatPercent,
		formatCompactNumber,
		formatCurrency,
		formatAge,
	} = useFormat();
	const showStats = useSidebarPreference("showConversationStats");
	const stats = useConversationStats({
		workspaceId,
		hostId,
		terminalId,
		lastEventAt,
		enabled: showStats,
	});
	if (!stats) return null;

	const share = stats.contextMax ? stats.contextUsed / stats.contextMax : null;
	const compact =
		share === null
			? formatCompactNumber(stats.contextUsed)
			: formatPercent(share, { maximumFractionDigits: 0 });
	const used = formatNumber(stats.contextUsed);
	const max = stats.contextMax === null ? null : formatNumber(stats.contextMax);

	const details: Array<{ label: string; value: string }> = [
		{ label: t`Model`, value: stats.model ?? t`Unknown` },
		{
			label: t`Context`,
			value: max === null ? t`${used} tokens` : t`${used} of ${max} tokens`,
		},
		{ label: t`Input tokens`, value: formatNumber(stats.inputTokens) },
		{
			label: t`Cached input tokens`,
			value: formatNumber(stats.cachedInputTokens),
		},
		{ label: t`Output tokens`, value: formatNumber(stats.outputTokens) },
	];
	if (stats.costUsd !== null) {
		details.push({
			label: t`Estimated cost`,
			value: formatCurrency(stats.costUsd, "USD"),
		});
	}
	details.push({ label: t`Turns`, value: formatNumber(stats.turns) });
	if (stats.startedAt !== null && stats.lastEventAt !== null) {
		details.push({
			label: t`Duration`,
			value: formatAge(stats.startedAt, stats.lastEventAt),
		});
	}

	return (
		<HoverCard openDelay={300} closeDelay={100}>
			<HoverCardTrigger asChild>
				<button
					type="button"
					aria-label={t`Context used: ${compact}`}
					onClick={stopEvent}
					className={cn(
						"shrink-0 rounded-sm px-1 text-[10px] tabular-nums hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						usageClass(share),
					)}
				>
					{compact}
				</button>
			</HoverCardTrigger>
			<HoverCardContent
				side="right"
				align="start"
				className="w-64 p-3"
				onClick={stopEvent}
			>
				<p className="mb-2 text-xs font-medium">
					<Trans>Context window</Trans>
				</p>
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
					{details.map(({ label, value }) => (
						<div key={label} className="contents">
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="min-w-0 truncate text-right tabular-nums">
								{value}
							</dd>
						</div>
					))}
				</dl>
			</HoverCardContent>
		</HoverCard>
	);
}

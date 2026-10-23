import { Trans } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import type { InsightsSummary } from "../../hooks/useHostInsights";
import { formatReplyTime } from "../../utils/formatReplyTime";

export function InsightsWeekTable({ summary }: { summary: InsightsSummary }) {
	const { formatDate, formatNumber, formatPercent } = useFormat();
	const decimal = (value: number | null) =>
		value === null ? "–" : formatNumber(value, { maximumFractionDigits: 1 });
	const percent = (value: number | null) =>
		value === null ? "–" : formatPercent(value, { maximumFractionDigits: 0 });

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-[12px] tabular-nums">
				<thead className="text-[11px] text-muted-foreground">
					<tr className="border-b text-right [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
						<th className="text-left">
							<Trans>Week of</Trans>
						</th>
						<th>
							<Trans>Msgs / day</Trans>
						</th>
						<th>
							<Trans>Reply</Trans>
						</th>
						<th>
							<Trans>Go-aheads</Trans>
						</th>
						<th>
							<Trans>Status</Trans>
						</th>
						<th>
							<Trans>Corrections</Trans>
						</th>
						<th>
							<Trans>Sessions / day</Trans>
						</th>
						<th>
							<Trans>Working</Trans>
						</th>
						<th>
							<Trans>Waiting</Trans>
						</th>
					</tr>
				</thead>
				<tbody>
					{[...summary.weeks].reverse().map((week) => (
						<tr
							key={week.weekStart}
							className="border-b text-right last:border-0 [&>td]:px-2 [&>td]:py-1.5"
						>
							<td className="text-left">
								{formatDate(Date.parse(`${week.weekStart}T12:00:00Z`), {
									month: "short",
									day: "numeric",
									timeZone: "UTC",
								})}
							</td>
							<td>{decimal(week.messagesPerWorkingDay)}</td>
							<td>{formatReplyTime(week.replyMedianSec)}</td>
							<td>{percent(week.goAheadShare)}</td>
							<td>{percent(week.statusCheckShare)}</td>
							<td>{percent(week.correctionShare)}</td>
							<td>{decimal(week.liveSessionsPerWorkingDay)}</td>
							<td>
								{decimal(week.meanWorking)} / {week.peakWorking}
							</td>
							<td>
								{decimal(week.meanWaiting)} / {week.peakWaiting}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

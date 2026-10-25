import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import type { InsightsSummary } from "../../hooks/useHostInsights";
import { formatReplyTime } from "../../utils/formatReplyTime";
import { InsightsStat, type InsightsTile } from "./components/InsightsStat";

type Week = InsightsSummary["weeks"][number];

/** This week against last week, with the goals the Desk is meant to reach. */
export function InsightsTiles({ summary }: { summary: InsightsSummary }) {
	const { t } = useLingui();
	const { formatNumber, formatPercent } = useFormat();
	const current = summary.weeks[summary.weeks.length - 1];
	const previous = summary.weeks[summary.weeks.length - 2] ?? null;
	if (!current) return null;

	const count = (value: number | null) =>
		value === null ? "–" : formatNumber(value, { maximumFractionDigits: 0 });
	const decimal = (value: number | null) =>
		value === null ? "–" : formatNumber(value, { maximumFractionDigits: 1 });
	const percent = (value: number | null) =>
		value === null ? "–" : formatPercent(value, { maximumFractionDigits: 0 });
	const meanAndPeak = (mean: number | null, peak: number) =>
		t({ message: `${decimal(mean)} · peak ${count(peak)}` });

	const tile = (
		label: string,
		pick: (week: Week) => string,
		goal?: { label: string; reached: (week: Week) => boolean | null },
	): InsightsTile => ({
		label,
		value: pick(current),
		previous: previous ? pick(previous) : null,
		target: goal?.label ?? null,
		onTarget: goal ? goal.reached(current) : null,
	});

	const below = (value: number | null, limit: number) =>
		value === null ? null : value < limit;

	const tiles: InsightsTile[] = [
		tile(
			t({ message: "Messages per working day" }),
			(week) => count(week.messagesPerWorkingDay),
			{
				label: `< ${count(50)}`,
				reached: (week) => below(week.messagesPerWorkingDay, 50),
			},
		),
		tile(
			t({ message: "Bare go-aheads" }),
			(week) => percent(week.goAheadShare),
			{
				label: `< ${percent(0.05)}`,
				reached: (week) => below(week.goAheadShare, 0.05),
			},
		),
		tile(
			t({ message: "Status questions" }),
			(week) => percent(week.statusCheckShare),
			{
				label: percent(0),
				reached: (week) =>
					week.statusCheckShare === null ? null : week.statusCheckShare === 0,
			},
		),
		tile(t({ message: "Corrections" }), (week) =>
			percent(week.correctionShare),
		),
		tile(t({ message: "Median reply time (daytime)" }), (week) =>
			formatReplyTime(week.replyMedianSec),
		),
		tile(t({ message: "Live sessions per day" }), (week) =>
			decimal(week.liveSessionsPerWorkingDay),
		),
		tile(t({ message: "Agents working at once" }), (week) =>
			meanAndPeak(week.meanWorking, week.peakWorking),
		),
		tile(t({ message: "Agents waiting on you" }), (week) =>
			meanAndPeak(week.meanWaiting, week.peakWaiting),
		),
	];

	return (
		<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
			{tiles.map((item) => (
				<InsightsStat key={item.label} tile={item} />
			))}
		</div>
	);
}

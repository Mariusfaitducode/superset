import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@superset/ui/chart";
import { useMemo } from "react";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import type { InsightsSummary } from "../../hooks/useHostInsights";

const MESSAGES_GOAL = 50;

/** Messages typed per day against the goal, with how many agents waited on the user. */
export function InsightsDailyChart({ summary }: { summary: InsightsSummary }) {
	const { t } = useLingui();
	const { formatDate, formatNumber } = useFormat();
	const config = useMemo(
		() =>
			({
				messages: { label: t({ message: "Messages" }), color: "#1596d6" },
				waiting: {
					label: t({ message: "Agents waiting (peak)" }),
					color: "#d06a48",
				},
			}) satisfies ChartConfig,
		[t],
	);
	const data = summary.days.map((day) => ({
		day: day.day,
		messages: day.messages,
		waiting: day.peakWaiting,
	}));
	const dayLabel = (day: string) =>
		formatDate(Date.parse(`${day}T12:00:00Z`), {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});

	return (
		<ChartContainer config={config} className="aspect-auto h-48 w-full">
			<ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
				<CartesianGrid vertical={false} strokeOpacity={0.35} />
				<XAxis
					dataKey="day"
					tickFormatter={dayLabel}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={24}
					className="text-[10px]"
				/>
				<YAxis
					width={32}
					tickCount={4}
					tickFormatter={(value: number) => formatNumber(value)}
					tickLine={false}
					axisLine={false}
					className="text-[10px]"
				/>
				<ReferenceLine
					y={MESSAGES_GOAL}
					stroke="var(--muted-foreground)"
					strokeDasharray="4 4"
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(value) => dayLabel(String(value))}
						/>
					}
				/>
				<Bar
					dataKey="messages"
					fill="var(--color-messages)"
					radius={[2, 2, 0, 0]}
				/>
				<Line
					dataKey="waiting"
					stroke="var(--color-waiting)"
					strokeWidth={1.5}
					dot={false}
					type="monotone"
				/>
			</ComposedChart>
		</ChartContainer>
	);
}

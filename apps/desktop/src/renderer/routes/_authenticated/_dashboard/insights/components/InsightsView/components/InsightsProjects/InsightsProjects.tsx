import { useFormat } from "@superset/i18n/react";
import type { InsightsSummary } from "../../hooks/useHostInsights";

const MAX_ROWS = 8;

export function InsightsProjects({ summary }: { summary: InsightsSummary }) {
	const { formatPercent } = useFormat();
	const rows = summary.projects.slice(0, MAX_ROWS);
	const top = rows[0]?.share ?? 0;

	return (
		<div className="flex flex-col gap-1.5">
			{rows.map((row) => (
				<div key={row.name} className="flex items-center gap-2 text-[12px]">
					<span className="w-40 shrink-0 truncate" title={row.name}>
						{row.name}
					</span>
					<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary/70"
							style={{ width: `${top > 0 ? (row.share / top) * 100 : 0}%` }}
						/>
					</div>
					<span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
						{formatPercent(row.share, { maximumFractionDigits: 0 })}
					</span>
				</div>
			))}
		</div>
	);
}

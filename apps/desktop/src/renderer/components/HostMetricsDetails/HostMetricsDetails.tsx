import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	getHostLoad,
	type HostMetrics,
	toGigabytes,
} from "renderer/hooks/host-service/useHostMetrics";
import { MetricMeter } from "./components/MetricMeter";
import { TopWorkspacesList } from "./components/TopWorkspacesList";

interface HostMetricsDetailsProps {
	metrics: HostMetrics;
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

export function HostMetricsDetails({ metrics }: HostMetricsDetailsProps) {
	const { t } = useLingui();
	const { formatNumber, formatPercent } = useFormat();
	const load = getHostLoad(metrics);

	const gigabytes = (bytes: number) =>
		formatNumber(toGigabytes(bytes), { maximumFractionDigits: 1 });
	const usedOfTotal = (used: number, total: number) =>
		`${gigabytes(used)} / ${formatNumber(toGigabytes(total), {
			style: "unit",
			unit: "gigabyte",
			maximumFractionDigits: 0,
		})}`;
	const uptime =
		metrics.uptimeSeconds >= SECONDS_PER_DAY
			? formatNumber(Math.floor(metrics.uptimeSeconds / SECONDS_PER_DAY), {
					style: "unit",
					unit: "day",
					unitDisplay: "long",
				})
			: formatNumber(Math.floor(metrics.uptimeSeconds / SECONDS_PER_HOUR), {
					style: "unit",
					unit: "hour",
					unitDisplay: "long",
				});
	const loadAverage = metrics.cpu.loadAverage
		.map((value) => formatNumber(value, { maximumFractionDigits: 1 }))
		.join(" · ");
	const cores = metrics.cpu.cores;
	const agents = metrics.agents.active;
	const terminals = metrics.terminals?.live ?? null;

	return (
		<div className="space-y-3">
			<div className="space-y-2.5">
				<MetricMeter
					label={t({ message: "CPU" })}
					value={load.cpu === null ? "—" : formatPercent(load.cpu)}
					share={load.cpu}
				/>
				<MetricMeter
					label={t({ message: "Memory" })}
					value={usedOfTotal(
						metrics.memory.usedBytes,
						metrics.memory.totalBytes,
					)}
					share={load.memory}
				/>
				{metrics.swap && (
					<MetricMeter
						label={t({ message: "Swap" })}
						value={usedOfTotal(metrics.swap.usedBytes, metrics.swap.totalBytes)}
						share={load.swap}
					/>
				)}
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
				<dt className="text-muted-foreground">{t({ message: "Agents" })}</dt>
				<dd className="text-right tabular-nums">{formatNumber(agents)}</dd>
				{terminals !== null && (
					<>
						<dt className="text-muted-foreground">
							{t({ message: "Terminals" })}
						</dt>
						<dd className="text-right tabular-nums">
							{formatNumber(terminals)}
						</dd>
					</>
				)}
				<dt className="text-muted-foreground">
					{t({ message: "Load average" })}
				</dt>
				<dd className="text-right tabular-nums">{loadAverage}</dd>
				<dt className="text-muted-foreground">{t({ message: "Cores" })}</dt>
				<dd className="text-right tabular-nums">{formatNumber(cores)}</dd>
				<dt className="text-muted-foreground">{t({ message: "Uptime" })}</dt>
				<dd className="text-right tabular-nums">{uptime}</dd>
			</dl>

			<TopWorkspacesList workspaces={metrics.topWorkspaces} />
		</div>
	);
}

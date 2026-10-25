import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useState } from "react";
import { LuServer } from "react-icons/lu";
import {
	getHostLoad,
	isHostHot,
} from "renderer/hooks/host-service/useHostMetrics";
import { HostLoadBars } from "./components/HostLoadBars";
import { HostMonitorHost } from "./components/HostMonitorHost";
import { HostSummaryLine } from "./components/HostSummaryLine";
import { useRemoteHostsMetrics } from "./hooks/useRemoteHostsMetrics";

interface HostMonitorProps {
	/** "compact" draws gauges only, for the narrow sidebar header. */
	variant?: "compact" | "full";
	align?: "start" | "end";
}

/**
 * Live load of the remote hosts this window can reach. Renders nothing when
 * no remote host is online; this machine has its own resource monitor.
 */
export function HostMonitor({
	variant = "compact",
	align = "start",
}: HostMonitorProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const hosts = useRemoteHostsMetrics();

	if (hosts.length === 0) return null;

	const entries = hosts.map((host) => {
		const metrics = host.result?.status === "ok" ? host.result.metrics : null;
		return { host, metrics, load: metrics ? getHostLoad(metrics) : null };
	});
	const anyHot = entries.some((entry) => entry.load && isHostHot(entry.load));

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={t({ message: "Remote host load" })}
							className={cn(
								"no-drag flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground data-[state=open]:bg-fill-hover data-[state=open]:text-foreground",
								anyHot && "text-red-500",
							)}
						>
							<LuServer className="size-3.5 shrink-0" />
							{entries.map(({ host, metrics, load }) =>
								variant === "full" && metrics ? (
									<HostSummaryLine
										key={host.hostId}
										name={host.name}
										metrics={metrics}
										className="max-w-[22rem]"
									/>
								) : (
									<HostLoadBars key={host.hostId} load={load} />
								),
							)}
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<div className="space-y-0.5 text-xs">
						{entries.map(({ host, metrics }) =>
							metrics ? (
								<HostSummaryLine
									key={host.hostId}
									name={host.name}
									metrics={metrics}
								/>
							) : (
								<div key={host.hostId}>{host.name}</div>
							),
						)}
					</div>
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				align={align}
				sideOffset={6}
				className="w-80 divide-y divide-border/60 p-0"
			>
				<div className="px-3.5 py-2 text-xs font-medium">
					<Trans>Remote hosts</Trans>
				</div>
				{hosts.map((host) => (
					<HostMonitorHost
						key={host.hostId}
						host={host}
						onNavigate={() => setOpen(false)}
					/>
				))}
			</PopoverContent>
		</Popover>
	);
}

import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { LuServer } from "react-icons/lu";
import { HostMetricsDetails } from "renderer/components/HostMetricsDetails";
import type { RemoteHostMetrics } from "../../hooks/useRemoteHostsMetrics";

interface HostMonitorHostProps {
	host: RemoteHostMetrics;
	onNavigate: () => void;
}

export function HostMonitorHost({ host, onNavigate }: HostMonitorHostProps) {
	const { t } = useLingui();
	const { result } = host;
	return (
		<section className="space-y-3 px-3.5 py-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-1.5">
					<LuServer className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="truncate text-[13px] font-medium">{host.name}</span>
				</div>
				<Link
					to="/settings/hosts/$hostId"
					params={{ hostId: host.hostId }}
					onClick={onNavigate}
					className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
					aria-label={t({ message: `Settings for ${host.name}` })}
				>
					<Trans>Settings</Trans>
				</Link>
			</div>
			{result?.status === "ok" ? (
				<HostMetricsDetails metrics={result.metrics} />
			) : result?.status === "unsupported" ? (
				<p className="text-xs text-muted-foreground">
					<Trans>
						This host runs an older host service. Update it to see its load.
					</Trans>
				</p>
			) : (
				<p className="text-xs text-muted-foreground">
					<Trans>Loading…</Trans>
				</p>
			)}
		</section>
	);
}

import { Trans } from "@lingui/react/macro";
import {
	HostMonitorHost,
	useRemoteHostsMetrics,
} from "renderer/routes/_authenticated/_dashboard/components/HostMonitor";

/** The other online hosts, so "where can I start an agent?" has one page. */
export function RemoteHostsSection() {
	const hosts = useRemoteHostsMetrics();
	if (hosts.length === 0) return null;
	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-[13px] font-medium">
				<Trans>Remote hosts</Trans>
			</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				{hosts.map((host) => (
					<div key={host.hostId} className="overflow-hidden rounded-lg border">
						<HostMonitorHost host={host} />
					</div>
				))}
			</div>
		</div>
	);
}

import { useMemo } from "react";
import {
	type HostMetricsResult,
	useHostsMetrics,
} from "renderer/hooks/host-service/useHostMetrics";
import { useHostUrls } from "renderer/hooks/host-service/useHostTargetUrl";
import { useKnownHosts } from "renderer/hooks/known-hosts/useKnownHosts";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";

export interface RemoteHostMetrics {
	hostId: string;
	name: string;
	/** Undefined while the first answer is pending or the host failed. */
	result: HostMetricsResult | undefined;
	/** The host is listed online but its service did not answer. */
	isUnreachable: boolean;
}

/** Load of every online host other than this machine, polled every 5 s. */
export function useRemoteHostsMetrics(): RemoteHostMetrics[] {
	const { machineId } = useLocalHostService();
	const { hosts } = useKnownHosts();
	const remoteHosts = useMemo(
		() => hosts.filter((host) => host.isOnline && host.machineId !== machineId),
		[hosts, machineId],
	);
	const hostIds = useMemo(
		() => remoteHosts.map((host) => host.machineId),
		[remoteHosts],
	);
	const urls = useHostUrls(hostIds);
	const queries = useHostsMetrics(urls.map((entry) => entry.url));
	return remoteHosts.map((host, index) => ({
		hostId: host.machineId,
		name: host.name,
		result: queries[index]?.data,
		isUnreachable: !queries[index]?.data && !!queries[index]?.isError,
	}));
}

import type { HostHealth } from "../../lib/host/health";

/**
 * The status line for a running host the cloud can't see, or "" when there is
 * nothing to say. A host with remote access off never registers, so the
 * restart hint only applies to a host that tried and failed.
 */
export function registrationWarning(args: {
	health: HostHealth;
	cloudRegistered: boolean | undefined;
	organizationName: string;
}): string {
	const { health, cloudRegistered, organizationName } = args;
	if (!health.healthy || cloudRegistered !== false) return "";

	if (health.cloudConnectEnabled === false) {
		return `\nWarning: not registered with the cloud for ${organizationName}: remote access is off for this host, so it never connects — hosts list, remote clients and automations won't see this machine\nHint: turn on remote access in the desktop app (Settings → Security; a Pro feature); restarting the host service won't change this`;
	}

	return `\nWarning: not registered with the cloud for ${organizationName}${
		health.registrationError ? ` (${health.registrationError})` : ""
	} — hosts list and automations won't see this machine\nHint: check host-service.log; registration retries automatically, or run: superset stop && superset start`;
}

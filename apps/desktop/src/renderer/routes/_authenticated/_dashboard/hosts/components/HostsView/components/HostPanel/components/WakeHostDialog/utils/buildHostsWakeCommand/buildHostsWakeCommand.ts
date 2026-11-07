import { quoteShellToken } from "renderer/lib/argv";

/**
 * Runs the host's wake command on this machine through the bundled CLI,
 * signed in the same way as the "Set up a host over SSH" dialog. A host with
 * no wake command makes the CLI say so and print the `set-wake` line.
 */
export function buildHostsWakeCommand(
	machineId: string,
	organizationId: string,
): string {
	const org = quoteShellToken(organizationId);
	return [
		`export SUPERSET_ORGANIZATION_ID=${org}`,
		`superset auth whoami >/dev/null 2>&1 || superset auth login --organization ${org} || exit 1`,
		`superset hosts wake --org ${org} --yes ${quoteShellToken(machineId)}`,
	].join("; ");
}

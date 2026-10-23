import { createApiClient } from "./api-client";
import { readConfig, resolveOrganizationId } from "./config";
import type { ResolvedAuth } from "./resolve-auth";

/**
 * Commands that only talk to this machine's host service, through its
 * manifest: they need no account. An agent's terminal often has no login of
 * its own and borrows the host's token, which times out when the machine is
 * loaded, so these fall back to running without one instead of failing.
 */
export const LOCAL_HOST_COMMANDS = new Set(["todos", "labels"]);

export function localOnlyAuth(): ResolvedAuth {
	const stored = readConfig();
	const organizationId = resolveOrganizationId(stored);
	return {
		config: { ...stored, organizationId },
		api: createApiClient({ bearer: "", organizationId }),
		bearer: "",
		authSource: "host",
	};
}

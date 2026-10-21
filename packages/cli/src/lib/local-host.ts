import { CLIError } from "@superset/cli-framework";
import { getHostId } from "@superset/shared/host-info";
import type { CliContext } from "./command";
import { resolveHostTarget } from "./host-target";

/** The host service of this machine, where its agents run. */
export async function localHostClient(ctx: CliContext) {
	const organizationId = ctx.config.organizationId;
	if (!organizationId) {
		throw new CLIError("No active organization", "Run: superset auth login");
	}
	const target = await resolveHostTarget({
		requestedHostId: getHostId(),
		organizationId,
		userJwt: ctx.bearer,
		api: ctx.api,
	});
	return target.client;
}

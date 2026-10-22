import { middleware } from "@superset/cli-framework";
import { trackCommandInvoked } from "../lib/analytics";
import { LOCAL_HOST_COMMANDS, localOnlyAuth } from "../lib/local-only-auth";
import { resolveAuth } from "../lib/resolve-auth";

/** A host this spawns outlives the hour a borrowed host token lasts. */
const COMMANDS_NEEDING_OWN_LOGIN = new Set(["start"]);

export default middleware(async (opts) => {
	const options = opts.options as { apiKey?: string };
	const command = opts.commandPath[0] ?? "";
	const { config, api, bearer, authSource } = await resolveAuth(
		options.apiKey,
		{ useHostToken: !COMMANDS_NEEDING_OWN_LOGIN.has(command) },
	).catch((error: unknown) => {
		if (LOCAL_HOST_COMMANDS.has(command)) return localOnlyAuth();
		throw error;
	});

	trackCommandInvoked({
		api,
		commandPath: opts.commandPath,
		flags: Object.keys(opts.options).filter(
			(k) => opts.options[k] !== undefined,
		),
	});

	return opts.next({
		ctx: { api, config, bearer, authSource },
	});
});

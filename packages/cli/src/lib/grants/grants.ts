import { CLIError } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";
import { todoActor } from "../todos";

export type GrantsState = Awaited<
	ReturnType<HostServiceClient["workspaceGrants"]["list"]["query"]>
>;
export type Grant = GrantsState["available"][number];
export type GrantId = Grant["id"];

/** The workspace the command runs in, unless the flag names another. */
export function grantWorkspace(
	flag: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const workspaceId = flag ?? env.SUPERSET_WORKSPACE_ID;
	if (!workspaceId) {
		throw new CLIError(
			"No workspace to read grants for",
			"Run it from a workspace's terminal, or pass --workspace.",
		);
	}
	return workspaceId;
}

/** Grants exist in the host's catalog only; unknown names fail with the list. */
export function findGrants(names: string[], available: Grant[]): GrantId[] {
	return names.map((name) => {
		const wanted = name.trim().toLowerCase();
		const grant = available.find((item) => item.id === wanted);
		if (!grant) {
			throw new CLIError(
				`No grant named ${name}`,
				`Grants: ${available.map((item) => item.id).join(", ")}`,
			);
		}
		return grant.id;
	});
}

/** The host refuses an agent changing its own workspace's grants. */
export function grantActor(env: NodeJS.ProcessEnv = process.env) {
	const actor = todoActor(env);
	return actor === "agent"
		? { actor, actorWorkspaceId: env.SUPERSET_WORKSPACE_ID }
		: { actor };
}

/** Grants live on the host of this machine, where the agents run. */
export async function localGrantsClient(ctx: CliContext) {
	return (await localHostClient(ctx)).workspaceGrants;
}

export async function changeGrants(
	ctx: CliContext,
	input: { workspace?: string; names: string[]; granted: boolean },
) {
	const client = await localGrantsClient(ctx);
	const workspaceId = grantWorkspace(input.workspace);
	const { available, workspaces } = await client.list.query();
	const picked = new Set(findGrants(input.names, available));
	const current = workspaces[workspaceId]?.grants ?? [];
	const grants = await client.set.mutate({
		...grantActor(),
		workspaceId,
		grants: input.granted
			? [...current, ...picked]
			: current.filter((id) => !picked.has(id)),
	});
	return {
		data: { workspaceId, grants },
		message: grants.length ? `Granted: ${grants.join(", ")}` : "No grants",
	};
}

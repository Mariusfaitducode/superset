import { CLIError } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";

export type Idea = Awaited<
	ReturnType<HostServiceClient["workspaceIdeas"]["list"]["query"]>
>[number];

export const IDEA_STATUSES = ["open", "kept", "dropped", "done"] as const;

/** The workspace the command runs in, unless the flag names another. */
export function ideaWorkspace(
	flag: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const workspaceId = flag ?? env.SUPERSET_WORKSPACE_ID;
	if (!workspaceId) {
		throw new CLIError(
			"No workspace to attach the idea to",
			"Run it from a workspace's terminal, or pass --workspace.",
		);
	}
	return workspaceId;
}

/** Accepts the short id `ideas list` prints, as long as it is unambiguous. */
export function resolveIdeaId(idOrPrefix: string, ideas: Idea[]): string {
	const matches = ideas.filter((idea) => idea.id.startsWith(idOrPrefix));
	if (matches.length === 1 && matches[0]) return matches[0].id;
	throw new CLIError(
		matches.length === 0
			? `Idea not found: ${idOrPrefix}`
			: `Several ideas start with ${idOrPrefix}`,
		"Run: superset ideas list --all",
	);
}

export function ideaRows(ideas: Idea[]) {
	return ideas.map((idea) => ({
		id: idea.id.slice(0, 8),
		status: idea.status,
		by: idea.createdBy,
		text: idea.note ? `${idea.text} — ${idea.note}` : idea.text,
	}));
}

/** Ideas live on the host of this machine, where the agents run. */
export async function localIdeasClient(ctx: CliContext) {
	return (await localHostClient(ctx)).workspaceIdeas;
}

// Same rule as to-dos: an agent's terminal acts as the agent.
export { clearable, todoActor as ideaActor } from "../todos";

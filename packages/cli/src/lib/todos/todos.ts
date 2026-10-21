import { CLIError, string } from "@superset/cli-framework";
import { getHostId } from "@superset/shared/host-info";
import type { CliContext } from "../command";
import { type HostServiceClient, resolveHostTarget } from "../host-target";

export type Todo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

export const TODO_PRIORITIES = ["high", "normal", "low"] as const;
export const TODO_KINDS = ["code", "message", "review", "other"] as const;

export const todoFieldOptions = {
	priority: string()
		.enum(...TODO_PRIORITIES)
		.desc("high, normal or low"),
	kind: string()
		.enum(...TODO_KINDS)
		.desc("code, message, review or other"),
	due: string().desc("Due day, YYYY-MM-DD (empty to clear)"),
	link: string().desc(
		"A URL the to-do is about: PR, Slack thread… (empty to clear)",
	),
};

/**
 * Agents run with `SUPERSET_AGENT_ID` set; their to-dos are marked as theirs
 * and the host keeps them from changing or deleting the user's.
 */
export function todoActor(env: NodeJS.ProcessEnv = process.env) {
	return env.SUPERSET_AGENT_ID ? ("agent" as const) : ("user" as const);
}

/** The conversation the command runs in, unless flags name another. */
export function todoConversation(
	flags: { workspace?: string; terminal?: string },
	env: NodeJS.ProcessEnv = process.env,
): { workspaceId: string; terminalId: string } {
	const workspaceId = flags.workspace ?? env.SUPERSET_WORKSPACE_ID;
	const terminalId = flags.terminal ?? env.SUPERSET_TERMINAL_ID;
	if (!workspaceId || !terminalId) {
		throw new CLIError(
			"No conversation to attach the to-do to",
			"Run it from an agent's terminal, or pass --workspace and --terminal.",
		);
	}
	return { workspaceId, terminalId };
}

/** Accepts the short id `todos list` prints, as long as it is unambiguous. */
export function resolveTodoId(idOrPrefix: string, todos: Todo[]): string {
	const matches = todos.filter((todo) => todo.id.startsWith(idOrPrefix));
	if (matches.length === 1 && matches[0]) return matches[0].id;
	throw new CLIError(
		matches.length === 0
			? `To-do not found: ${idOrPrefix}`
			: `Several to-dos start with ${idOrPrefix}`,
		"Run: superset todos list --all",
	);
}

/** `""` clears an optional field, anything else sets it. */
export function clearable(
	value: string | undefined,
): string | null | undefined {
	if (value === undefined) return undefined;
	return value.trim() === "" ? null : value.trim();
}

export function todoRows(todos: Todo[]) {
	return todos.map((todo) => ({
		id: todo.id.slice(0, 8),
		done: todo.done ? "✓" : "",
		priority: todo.priority,
		kind: todo.kind,
		due: todo.dueOn ?? "",
		by: todo.author,
		text: todo.text,
	}));
}

/** To-dos live on the host of this machine, where the agents run. */
export async function localTodosClient(ctx: CliContext) {
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
	return target.client.conversationTodos;
}

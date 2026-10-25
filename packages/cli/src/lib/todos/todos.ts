import { CLIError, string } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";

export type Todo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

export const TODO_PRIORITIES = ["high", "normal", "low"] as const;
export const TODO_KINDS = [
	"code",
	"message",
	"review",
	"other",
	"mail",
	"contact",
	"post",
	"meeting",
] as const;

export const todoFieldOptions = {
	priority: string()
		.enum(...TODO_PRIORITIES)
		.desc("high, normal or low"),
	kind: string()
		.enum(...TODO_KINDS)
		.desc("code, message, review, mail, contact, post, meeting or other"),
	due: string().desc("Due day, YYYY-MM-DD (empty to clear)"),
	link: string().desc(
		"A URL the to-do is about: PR, Slack thread… (empty to clear)",
	),
	step: string()
		.variadic()
		.desc(
			"A step for the user, in order; repeat for each (edit replaces them all, empty clears)",
		),
	draft: string().desc(
		"Ready-to-send text: the mail, message or post (empty to clear)",
	),
	recipient: string().desc("Who it goes to (empty to clear)"),
	channel: string().desc("Where it goes: email, LinkedIn… (empty to clear)"),
};

/**
 * The rich fields the flags set. A field left out stays as it is; `--step`
 * replaces every step.
 */
export function richFields(options: {
	step?: string[];
	draft?: string;
	recipient?: string;
	channel?: string;
}) {
	const steps = options.step?.map((step) => step.trim()).filter(Boolean);
	return {
		...(options.step?.length ? { steps } : {}),
		...(options.draft !== undefined ? { draft: draftText(options.draft) } : {}),
		...(options.recipient !== undefined
			? { recipient: clearable(options.recipient) }
			: {}),
		...(options.channel !== undefined
			? { channel: clearable(options.channel) }
			: {}),
	};
}

// Agents often write `"Hi\n\nThanks"`, which the shell passes as a literal
// backslash-n rather than a line break.
export function draftText(value: string): string | null {
	const text =
		value.includes("\\n") && !value.includes("\n")
			? value.replaceAll("\\n", "\n")
			: value;
	return text.trim() === "" ? null : text.trim();
}

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
	return (await localHostClient(ctx)).conversationTodos;
}

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

function byUrgency(a: Todo, b: Todo): number {
	const due = (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
	return due || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

function indent(text: string, prefix: string): string {
	return text
		.split("\n")
		.map((line) => (line ? prefix + line : line))
		.join("\n");
}

function todoBrief(todo: Todo, today: string): string {
	const tags = [
		todo.kind !== "other" ? todo.kind : null,
		todo.priority !== "normal" ? `${todo.priority} priority` : null,
		todo.dueOn
			? `${todo.dueOn < today ? "overdue, " : ""}due ${todo.dueOn}`
			: null,
		todo.author === "agent" ? "from the agent" : null,
	].filter(Boolean);
	const lines = [
		`- [ ] **${todo.text}**${tags.length ? ` (${tags.join(", ")})` : ""}`,
	];
	const steps = todo.steps ?? [];
	const route = [
		todo.recipient ? `To: ${todo.recipient}` : null,
		todo.channel ? `Via: ${todo.channel}` : null,
	].filter(Boolean);
	if (route.length) lines.push(`  - ${route.join(" · ")}`);
	if (todo.link) lines.push(`  - Link: ${todo.link}`);
	if (steps.length) {
		lines.push("  - Steps:");
		steps.forEach((step, index) => {
			lines.push(`    ${index + 1}. ${step}`);
		});
	}
	if (todo.draft) {
		lines.push(
			"  - Draft:",
			"",
			"    ~~~~",
			indent(todo.draft, "    "),
			"    ~~~~",
		);
	}
	return lines.join("\n");
}

/**
 * A Markdown brief of the open to-dos, by workspace then conversation, with
 * everything the user needs to act: steps, recipient, channel and draft.
 */
export function todoReport(
	todos: Todo[],
	workspaceNames: ReadonlyMap<string, string> = new Map(),
	today: string = new Date().toISOString().slice(0, 10),
): string {
	const open = todos.filter((todo) => !todo.done);
	const header = `# To-do brief, ${today}`;
	if (open.length === 0) return `${header}\n\nNothing open.\n`;
	const byWorkspace = new Map<string, Map<string, Todo[]>>();
	for (const todo of open) {
		const conversations =
			byWorkspace.get(todo.workspaceId) ?? new Map<string, Todo[]>();
		const key = todo.conversationId ?? todo.terminalId;
		conversations.set(key, [...(conversations.get(key) ?? []), todo]);
		byWorkspace.set(todo.workspaceId, conversations);
	}
	const sections = [
		header,
		`${open.length} open to-do${open.length === 1 ? "" : "s"}.`,
	];
	for (const [workspaceId, conversations] of byWorkspace) {
		sections.push(`## ${workspaceNames.get(workspaceId) ?? workspaceId}`);
		for (const [conversation, list] of conversations) {
			sections.push(`### Conversation ${conversation.slice(0, 8)}`);
			sections.push(
				[...list]
					.sort(byUrgency)
					.map((todo) => todoBrief(todo, today))
					.join("\n"),
			);
		}
	}
	return `${sections.join("\n\n")}\n`;
}

import type { GrantsState } from "../grants";
import type { Note } from "../notes";
import type { Todo } from "../todos";

/** Each part is null when this host is too old to keep it. */
export interface ContextInput {
	workspaceId: string;
	todos: Todo[] | null;
	labels: string[] | null;
	grants: GrantsState | null;
	notes: Note[] | null;
}

const LISTED = 8;
const UNAVAILABLE = "unavailable on this host, update the app";

function isActive(note: Note): boolean {
	return note.status === "open" || note.status === "kept";
}

function indent(text: string): string {
	return text
		.split("\n")
		.map((line) => `    ${line}`.trimEnd())
		.join("\n");
}

function grantLines(state: GrantsState | null, workspaceId: string): string[] {
	if (!state) return [`- Grants: ${UNAVAILABLE}.`];
	const on = new Set<string>(state.workspaces[workspaceId]?.grants ?? []);
	const granted = state.available.filter((grant) => on.has(grant.id));
	const rule =
		"  Anything else that leaves this machine (push, PR, comment, message): propose it to the user as a draft or a decision, never as a question in the chat. Local commits are always fine.";
	if (granted.length === 0) {
		return ["- Grants: none. The user has not allowed anything yet.", rule];
	}
	return [
		"- Grants: the user lets you do this without asking:",
		...granted.map((grant) => `  - ${grant.id}: ${grant.description}`),
		rule,
	];
}

/**
 * The block an agent gets at session start: what is open for it, what it
 * may do without asking, and what the user pinned for every agent here.
 */
export function formatContext(input: ContextInput): string {
	const lines = ["Superset context for this workspace."];

	if (!input.todos) {
		lines.push(`- To-dos: ${UNAVAILABLE}.`);
	} else {
		const open = input.todos.filter((todo) => !todo.done);
		lines.push(
			`- Open to-dos of this conversation: ${open.length}${open.length ? "" : " (add yours with `superset todos add`)"}`,
			...open
				.slice(0, LISTED)
				.map((todo) => `  - [${todo.author}] ${todo.text}`),
		);
	}

	if (input.labels) {
		lines.push(
			`- Workspace labels on: ${input.labels.join(", ") || "none"} (set \`In progress\` while working: \`superset labels add "In progress"\`)`,
		);
	}

	lines.push(...grantLines(input.grants, input.workspaceId));

	if (!input.notes) {
		lines.push(`- Notes: ${UNAVAILABLE}.`);
	} else {
		const active = input.notes.filter(isActive);
		const pinned = active.filter((note) => note.kind === "context");
		const others = active.filter((note) => note.kind !== "context");
		if (pinned.length) {
			lines.push("- Pinned context, read it before you start:");
			for (const note of pinned) {
				lines.push(`  - ${note.text}`);
				if (note.details) lines.push(indent(note.details));
			}
		}
		lines.push(
			`- Open notes on this workspace: ${others.length}`,
			...others.slice(0, LISTED).map((note) => `  - ${note.text}`),
		);
	}

	return lines.join("\n");
}

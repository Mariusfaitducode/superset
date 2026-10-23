import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const TODO_PRIORITIES = ["high", "normal", "low"] as const;
export const TODO_KINDS = ["code", "message", "review", "other"] as const;
export const TODO_ACTORS = ["user", "agent"] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number];
export type TodoKind = (typeof TODO_KINDS)[number];
/** Who acts on a to-do: the user in the app, or an agent through the CLI. */
export type TodoActor = (typeof TODO_ACTORS)[number];

export interface ConversationTodo {
	id: string;
	workspaceId: string;
	terminalId: string;
	/**
	 * The agent's own session id. A resumed agent runs in a new terminal under
	 * the same id, so this is what ties a to-do to its conversation. Absent on
	 * to-dos written before it existed, and on terminals without an agent.
	 */
	conversationId?: string | null;
	text: string;
	done: boolean;
	author: TodoActor;
	/** Who checked it, so the user can tell an agent's check from their own. */
	doneBy: TodoActor | null;
	priority: TodoPriority;
	kind: TodoKind;
	/** Calendar day, `YYYY-MM-DD`. */
	dueOn: string | null;
	link: string | null;
	createdAt: number;
	updatedAt: number;
	/**
	 * Set when the to-do is closed: it is kept, out of the list, so there is
	 * a trace of it. Absent on to-dos written before archiving existed.
	 */
	archivedAt?: number | null;
	archivedBy?: TodoActor | null;
}

export interface TodoFields {
	text?: string;
	priority?: TodoPriority;
	kind?: TodoKind;
	dueOn?: string | null;
	link?: string | null;
}

export class TodoPermissionError extends Error {}
export class TodoNotFoundError extends Error {}

export const MAX_CONVERSATIONS = 200;
export const MAX_TODOS_PER_CONVERSATION = 100;
export const MAX_ARCHIVED_PER_CONVERSATION = 200;

interface TodoFile {
	version: 1;
	todos: ConversationTodo[];
}

export function defaultTodosPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "conversation-todos.json");
}

/**
 * The to-dos of every agent conversation on this host, in one JSON file the
 * app and the agents' CLI both go through. Agents may check any to-do but
 * only change or archive their own: the user's to-dos say what the user
 * wants, and an agent rewriting them would make the list untrustworthy.
 * Nothing is deleted: closing a to-do archives it.
 */
export class ConversationTodoStore {
	private todos: ConversationTodo[] | null = null;

	constructor(
		private readonly filePath: string = defaultTodosPath(),
		private readonly now: () => number = Date.now,
	) {}

	/** The open list by default; `archived` gives the archived ones instead. */
	list(
		filter: { workspaceId?: string; terminalId?: string; archived?: boolean } = {},
	) {
		const archived = filter.archived ?? false;
		return this.load().filter(
			(todo) =>
				isArchived(todo) === archived &&
				(!filter.workspaceId || todo.workspaceId === filter.workspaceId) &&
				(!filter.terminalId || todo.terminalId === filter.terminalId),
		);
	}

	add(input: {
		actor: TodoActor;
		workspaceId: string;
		terminalId: string;
		conversationId?: string | null;
		text: string;
		priority?: TodoPriority;
		kind?: TodoKind;
		dueOn?: string | null;
		link?: string | null;
	}): ConversationTodo {
		const text = input.text.trim();
		if (!text) throw new Error("A to-do needs some text");
		const at = this.now();
		const todo: ConversationTodo = {
			id: randomUUID(),
			workspaceId: input.workspaceId,
			terminalId: input.terminalId,
			conversationId: input.conversationId ?? null,
			text,
			done: false,
			author: input.actor,
			doneBy: null,
			priority: input.priority ?? "normal",
			kind: input.kind ?? "other",
			dueOn: input.dueOn ?? null,
			link: input.link ?? null,
			createdAt: at,
			updatedAt: at,
			archivedAt: null,
			archivedBy: null,
		};
		this.save([...this.load(), todo]);
		return todo;
	}

	update(actor: TodoActor, id: string, fields: TodoFields): ConversationTodo {
		const todo = this.get(id);
		this.assertOwns(actor, todo, "change");
		const text = fields.text?.trim();
		if (fields.text !== undefined && !text) {
			throw new Error("A to-do needs some text");
		}
		return this.replace({
			...todo,
			...(text ? { text } : {}),
			...(fields.priority ? { priority: fields.priority } : {}),
			...(fields.kind ? { kind: fields.kind } : {}),
			...(fields.dueOn !== undefined ? { dueOn: fields.dueOn } : {}),
			...(fields.link !== undefined ? { link: fields.link } : {}),
		});
	}

	setDone(actor: TodoActor, id: string, done: boolean): ConversationTodo {
		const todo = this.get(id);
		return this.replace({ ...todo, done, doneBy: done ? actor : null });
	}

	archive(actor: TodoActor, id: string): ConversationTodo {
		const todo = this.get(id);
		this.assertOwns(actor, todo, "archive");
		if (isArchived(todo)) return todo;
		return this.replace({
			...todo,
			archivedAt: this.now(),
			archivedBy: actor,
		});
	}

	restore(actor: TodoActor, id: string): ConversationTodo {
		const todo = this.get(id);
		this.assertOwns(actor, todo, "restore");
		if (!isArchived(todo)) return todo;
		return this.replace({ ...todo, archivedAt: null, archivedBy: null });
	}

	/**
	 * Moves a conversation's to-dos to the terminal it now runs in. To-dos
	 * that predate `conversationId` are recognised by the terminals the
	 * conversation ran in before (`formerTerminalIds`), and get stamped.
	 * Returns how many moved.
	 */
	followConversation(input: {
		conversationId: string;
		terminalId: string;
		workspaceId: string;
		formerTerminalIds: readonly string[];
	}): number {
		const known = new Set([...input.formerTerminalIds, input.terminalId]);
		let changed = false;
		let moved = 0;
		const todos = this.load().map((todo) => {
			const belongs = todo.conversationId
				? todo.conversationId === input.conversationId
				: known.has(todo.terminalId);
			if (
				!belongs ||
				(todo.terminalId === input.terminalId &&
					todo.conversationId === input.conversationId)
			) {
				return todo;
			}
			changed = true;
			if (todo.terminalId !== input.terminalId) moved++;
			return {
				...todo,
				conversationId: input.conversationId,
				terminalId: input.terminalId,
				workspaceId: input.workspaceId,
			};
		});
		if (changed) this.save(todos);
		return moved;
	}

	/** Archives the checked to-dos of a conversation that the actor may archive. */
	clearDone(actor: TodoActor, terminalId: string): number {
		const at = this.now();
		let cleared = 0;
		const todos = this.load().map((todo) => {
			if (
				todo.terminalId !== terminalId ||
				!todo.done ||
				isArchived(todo) ||
				!this.owns(actor, todo)
			) {
				return todo;
			}
			cleared++;
			return { ...todo, archivedAt: at, archivedBy: actor, updatedAt: at };
		});
		if (cleared > 0) this.save(todos);
		return cleared;
	}

	private owns(actor: TodoActor, todo: ConversationTodo): boolean {
		return actor === "user" || todo.author === "agent";
	}

	private assertOwns(
		actor: TodoActor,
		todo: ConversationTodo,
		action: string,
	): void {
		if (this.owns(actor, todo)) return;
		throw new TodoPermissionError(
			`Agents can check the user's to-dos but not ${action} them`,
		);
	}

	private get(id: string): ConversationTodo {
		const todo = this.load().find((item) => item.id === id);
		if (!todo) throw new TodoNotFoundError(`To-do not found: ${id}`);
		return todo;
	}

	private replace(todo: ConversationTodo): ConversationTodo {
		const updated = { ...todo, updatedAt: this.now() };
		this.save(
			this.load().map((item) => (item.id === todo.id ? updated : item)),
		);
		return updated;
	}

	private load(): ConversationTodo[] {
		if (this.todos) return this.todos;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as TodoFile;
			this.todos = Array.isArray(file.todos) ? file.todos : [];
		} catch {
			this.todos = [];
		}
		return this.todos;
	}

	private save(todos: ConversationTodo[]): void {
		this.todos = bound(todos);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: TodoFile = { version: 1, todos: this.todos };
			writeFileSync(temporaryPath, JSON.stringify(file, null, "\t"));
			renameSync(temporaryPath, this.filePath);
		} catch (error) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Best-effort cleanup after a failed write or rename.
			}
			throw error;
		}
	}
}

function isArchived(todo: ConversationTodo): boolean {
	return todo.archivedAt != null;
}

// Archived to-dos get their own cap so a long history never pushes open
// to-dos out; past it the oldest archived go first.
function boundConversation(list: ConversationTodo[]): ConversationTodo[] {
	const open = list.filter((todo) => !isArchived(todo));
	const keptArchived = new Set(
		list
			.filter(isArchived)
			.sort((a, b) => (a.archivedAt ?? 0) - (b.archivedAt ?? 0))
			.slice(-MAX_ARCHIVED_PER_CONVERSATION),
	);
	const keptOpen = new Set(open.slice(-MAX_TODOS_PER_CONVERSATION));
	return list.filter((todo) => keptOpen.has(todo) || keptArchived.has(todo));
}

// A conversation's to-dos follow it to its latest terminal, so old terminal
// ids never come back: once the cap is reached the conversation touched
// longest ago goes first.
function bound(todos: ConversationTodo[]): ConversationTodo[] {
	const byTerminal = new Map<string, ConversationTodo[]>();
	for (const todo of todos) {
		const list = byTerminal.get(todo.terminalId) ?? [];
		list.push(todo);
		byTerminal.set(todo.terminalId, list);
	}
	const lastTouched = (list: ConversationTodo[]) =>
		Math.max(...list.map((todo) => todo.updatedAt));
	return [...byTerminal.values()]
		.sort((a, b) => lastTouched(b) - lastTouched(a))
		.slice(0, MAX_CONVERSATIONS)
		.flatMap(boundConversation);
}

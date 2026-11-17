import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The states the user (or an agent) can pin on a conversation. "working" is
 * never pinned: a running agent always shows as working.
 */
export const CONVERSATION_MARK_STATES = [
	"waiting",
	"resume",
	"todos",
	"done",
] as const;
export const MARK_ACTORS = ["user", "agent"] as const;

export type ConversationMarkState = (typeof CONVERSATION_MARK_STATES)[number];
export type MarkActor = (typeof MARK_ACTORS)[number];

export interface ConversationMark {
	terminalId: string;
	workspaceId: string;
	/** The agent session, so the mark follows a resumed conversation. */
	conversationId: string | null;
	state: ConversationMarkState;
	setBy: MarkActor;
	setAt: number;
}

export const MAX_MARKS = 500;

interface MarkFile {
	version: 1;
	marks: ConversationMark[];
}

export function defaultMarksPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "conversation-states.json");
}

/**
 * One pinned state per conversation, over the state the app infers. A new
 * turn clears it (see `watchConversationTurns`): once the user prompts the
 * agent again, the old "resume later" or "done" no longer holds.
 */
export class ConversationMarkStore {
	private marks: ConversationMark[] | null = null;

	constructor(
		private readonly filePath: string = defaultMarksPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(filter: { workspaceId?: string; terminalId?: string } = {}) {
		return this.load().filter(
			(mark) =>
				(!filter.workspaceId || mark.workspaceId === filter.workspaceId) &&
				(!filter.terminalId || mark.terminalId === filter.terminalId),
		);
	}

	set(input: {
		terminalId: string;
		workspaceId: string;
		conversationId: string | null;
		state: ConversationMarkState;
		actor: MarkActor;
	}): ConversationMark {
		const mark: ConversationMark = {
			terminalId: input.terminalId,
			workspaceId: input.workspaceId,
			conversationId: input.conversationId,
			state: input.state,
			setBy: input.actor,
			setAt: this.now(),
		};
		this.save([
			...this.load().filter((item) => item.terminalId !== input.terminalId),
			mark,
		]);
		return mark;
	}

	/** Back to the inferred state. Answers whether a mark was removed. */
	clear(terminalId: string): boolean {
		const marks = this.load();
		const kept = marks.filter((mark) => mark.terminalId !== terminalId);
		if (kept.length === marks.length) return false;
		this.save(kept);
		return true;
	}

	/** Drops the mark of a conversation whose new turn began at `at`. */
	clearIfOlder(terminalId: string, at: number): boolean {
		const mark = this.load().find((item) => item.terminalId === terminalId);
		if (!mark || mark.setAt >= at) return false;
		return this.clear(terminalId);
	}

	/** Moves a resumed conversation's mark to its new terminal. */
	followConversation(input: {
		conversationId: string;
		terminalId: string;
		workspaceId: string;
	}): boolean {
		let changed = false;
		const marks = this.load().map((mark) => {
			if (
				mark.conversationId !== input.conversationId ||
				mark.terminalId === input.terminalId
			) {
				return mark;
			}
			changed = true;
			return {
				...mark,
				terminalId: input.terminalId,
				workspaceId: input.workspaceId,
			};
		});
		if (!changed) return false;
		// A newer mark already on the target terminal wins.
		const byTerminal = new Map<string, ConversationMark>();
		for (const mark of marks) {
			const known = byTerminal.get(mark.terminalId);
			if (!known || known.setAt <= mark.setAt)
				byTerminal.set(mark.terminalId, mark);
		}
		this.save([...byTerminal.values()]);
		return true;
	}

	private load(): ConversationMark[] {
		if (this.marks) return this.marks;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as MarkFile;
			this.marks = Array.isArray(file.marks) ? file.marks : [];
		} catch {
			this.marks = [];
		}
		return this.marks;
	}

	private save(marks: ConversationMark[]): void {
		this.marks = [...marks].sort((a, b) => a.setAt - b.setAt).slice(-MAX_MARKS);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: MarkFile = { version: 1, marks: this.marks };
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

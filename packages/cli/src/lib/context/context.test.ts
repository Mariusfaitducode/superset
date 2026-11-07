import { describe, expect, test } from "bun:test";
import type { GrantsState } from "../grants";
import type { Note } from "../notes";
import type { Todo } from "../todos";
import { formatContext } from "./context";

const grants = {
	available: [
		{ id: "push-own-branch", description: "Push this workspace's branch" },
		{ id: "slack-draft", description: "Save Slack drafts" },
	],
	workspaces: {
		ws: { grants: ["push-own-branch"], updatedAt: 1, updatedBy: "user" },
	},
} as GrantsState;

const note = (fields: Partial<Note>) =>
	({ kind: "note", status: "open", details: null, ...fields }) as Note;

describe("formatContext", () => {
	test("lists to-dos, labels, grants, pinned context and notes", () => {
		const text = formatContext({
			workspaceId: "ws",
			todos: [
				{ text: "Review it", author: "user", done: false },
				{ text: "Old", author: "agent", done: true },
			] as Todo[],
			labels: ["Today"],
			grants,
			notes: [
				note({ text: "Brief", kind: "context", details: "Line 1\nLine 2" }),
				note({ text: "Dropped brief", kind: "context", status: "dropped" }),
				note({ text: "Idea" }),
			],
		});
		expect(text).toBe(
			[
				"Superset context for this workspace.",
				"- Open to-dos of this conversation: 1",
				"  - [user] Review it",
				'- Workspace labels on: Today (set `In progress` while working: `superset labels add "In progress"`)',
				"- Grants: the user lets you do this without asking:",
				"  - push-own-branch: Push this workspace's branch",
				"  Anything else that leaves this machine (push, PR, comment, message): propose it to the user as a draft or a decision, never as a question in the chat. Local commits are always fine.",
				"- Pinned context, read it before you start:",
				"  - Brief",
				"    Line 1",
				"    Line 2",
				"- Open notes on this workspace: 1",
				"  - Idea",
			].join("\n"),
		);
	});

	test("says what an older host does not keep", () => {
		const text = formatContext({
			workspaceId: "other",
			todos: null,
			labels: null,
			grants: null,
			notes: null,
		});
		expect(text).toContain("- To-dos: unavailable on this host");
		expect(text).toContain("- Grants: unavailable on this host");
		expect(text).not.toContain("labels");
	});

	test("says when nothing is granted", () => {
		const text = formatContext({
			workspaceId: "other",
			todos: [],
			labels: [],
			grants,
			notes: [],
		});
		expect(text).toContain("- Grants: none.");
		expect(text).toContain("add yours with `superset todos add`");
	});
});

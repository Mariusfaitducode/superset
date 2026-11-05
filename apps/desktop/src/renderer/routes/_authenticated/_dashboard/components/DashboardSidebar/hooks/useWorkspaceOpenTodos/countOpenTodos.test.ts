import { expect, test } from "bun:test";
import { countOpenTodos } from "./countOpenTodos";

const todo = (
	terminalId: string,
	fields: { done?: boolean; priority?: string; author?: string } = {},
) => ({
	workspaceId: "w",
	terminalId,
	done: false,
	...fields,
});

test("counts the open to-dos of the workspace's live conversations", () => {
	const todos = [
		todo("a"),
		todo("a", { done: true, priority: "high" }),
		todo("b", { priority: "high", author: "agent" }),
		todo("gone", { priority: "high" }),
		{ ...todo("a"), workspaceId: "other" },
	];
	const live = new Set(["a", "b"]);
	expect(
		countOpenTodos({
			todos,
			workspaceId: "w",
			liveTerminalIds: live,
			includeAgentTodos: true,
		}),
	).toEqual({ open: 2, urgent: true });
	expect(
		countOpenTodos({
			todos,
			workspaceId: "w",
			liveTerminalIds: live,
			includeAgentTodos: false,
		}),
	).toEqual({ open: 1, urgent: false });
});

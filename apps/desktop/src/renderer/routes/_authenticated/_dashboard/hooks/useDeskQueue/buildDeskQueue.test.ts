import { describe, expect, test } from "bun:test";
import type { AgentReport } from "renderer/hooks/host-service/useHostAgentReports";
import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import {
	buildDeskQueue,
	type DeskHostData,
	type DeskSources,
} from "./buildDeskQueue";
import { readRichTodo } from "./richTodo";
import { isTodoForUser } from "./todoAudience";

const report = (fields: Partial<AgentReport>) =>
	({
		id: "r",
		workspaceId: "ws",
		terminalId: "term",
		kind: "done",
		status: "open",
		createdAt: 0,
		...fields,
	}) as AgentReport;

const todo = (fields: Partial<ConversationTodo>) =>
	({
		id: "t",
		workspaceId: "ws",
		terminalId: "term",
		author: "agent",
		done: false,
		priority: "normal",
		kind: "other",
		dueOn: null,
		createdAt: 0,
		...fields,
	}) as ConversationTodo;

const conversation = (fields: Partial<AgentConversation>) =>
	({
		terminalId: "term",
		workspaceId: "ws",
		title: "Fix the build",
		state: "request",
		since: 0,
		...fields,
	}) as AgentConversation;

const pr = (
	fields: Partial<MyPullRequestItem>,
	reviewRequested = true,
): MyPullRequestItem => ({
	projectId: "proj",
	repoFullName: "org/repo",
	prNumber: 1,
	title: "A PR",
	url: "https://github.com/org/repo/pull/1",
	isDraft: false,
	authorLogin: "pb",
	updatedAt: "2026-11-01T00:00:00Z",
	details: {
		viewerIsAuthor: false,
		reviewRequestedFromViewer: reviewRequested,
		reviewRequestedAt: null,
	} as MyPullRequestItem["details"],
	...fields,
});

const host = (data: Partial<DeskHostData>): DeskHostData => ({
	hostUrl: "h",
	reports: null,
	todos: null,
	pullRequests: null,
	...data,
});

const sources = (fields: Partial<DeskSources>): DeskSources => ({
	hosts: [],
	conversations: [],
	workspaces: new Map([
		["ws", { name: "Desk", projectName: "Superset", hostUrl: "h" }],
	]),
	projectNames: new Map([["proj", "Superset"]]),
	today: "2026-11-05",
	...fields,
});

const keys = (fields: Partial<DeskSources>) =>
	buildDeskQueue(sources(fields)).map((item) => `${item.section}:${item.key}`);

describe("buildDeskQueue", () => {
	test("puts what blocks an agent first, then urgent to-dos, then the rest", () => {
		expect(
			keys({
				hosts: [
					host({
						reports: [
							report({ id: "done", kind: "done", createdAt: 1 }),
							report({ id: "draft", kind: "draft", createdAt: 1 }),
							report({ id: "decision", kind: "decision", createdAt: 5 }),
						],
						todos: [
							todo({ id: "high", priority: "high" }),
							todo({ id: "normal" }),
						],
						pullRequests: [pr({})],
					}),
				],
				conversations: [
					conversation({ terminalId: "asks", state: "request" }),
					conversation({ terminalId: "broke", state: "failed" }),
				],
			}),
		).toEqual([
			"now:conversation:asks",
			"now:conversation:broke",
			"now:report:decision",
			"now:report:draft",
			"now:todo:high",
			"next:report:done",
			"next:pr:org/repo#1",
			"next:todo:normal",
		]);
	});

	test("orders the same kind by how long it has waited", () => {
		expect(
			keys({
				hosts: [
					host({
						reports: [
							report({ id: "new", kind: "decision", createdAt: 9 }),
							report({ id: "old", kind: "decision", createdAt: 2 }),
						],
					}),
				],
			}),
		).toEqual(["now:report:old", "now:report:new"]);
	});

	test("an overdue or due-today to-do is urgent, overdue first", () => {
		expect(
			keys({
				hosts: [
					host({
						todos: [
							todo({ id: "today", dueOn: "2026-11-05" }),
							todo({ id: "high", priority: "high" }),
							todo({ id: "late", dueOn: "2026-11-01", priority: "low" }),
							todo({ id: "later", dueOn: "2026-11-20" }),
						],
					}),
				],
			}),
		).toEqual([
			"now:todo:late",
			"now:todo:high",
			"now:todo:today",
			"next:todo:later",
		]);
	});

	test("a finished turn with an open report shows once, as the report", () => {
		expect(
			keys({
				hosts: [host({ reports: [report({ id: "r", kind: "decision" })] })],
				conversations: [
					conversation({ terminalId: "term", state: "unseen" }),
					conversation({ terminalId: "other", state: "unseen" }),
				],
			}),
		).toEqual(["now:report:r", "next:conversation:other"]);
	});

	test("a permission prompt stays next to the report of the same agent", () => {
		expect(
			keys({
				hosts: [host({ reports: [report({ id: "r", kind: "decision" })] })],
				conversations: [conversation({ terminalId: "term", state: "request" })],
			}),
		).toEqual(["now:conversation:term", "now:report:r"]);
	});

	test("leaves out what does not wait on the user", () => {
		expect(
			keys({
				hosts: [
					host({
						reports: [
							report({ id: "a", kind: "progress" }),
							report({ id: "b", status: "answered" }),
							report({ id: "c", workspaceId: "archived" }),
						],
						todos: [
							todo({ id: "own-work", author: "agent", kind: "code" }),
							todo({ id: "checked", done: true }),
							todo({ id: "gone", workspaceId: "archived" }),
						],
						pullRequests: [pr({ prNumber: 2 }, false)],
					}),
					host({ hostUrl: "old-host" }),
				],
				conversations: [
					conversation({ terminalId: "w", state: "working" }),
					conversation({ terminalId: "s", state: "seen" }),
					conversation({ terminalId: "i", state: "idle" }),
				],
			}),
		).toEqual([]);
	});

	test("says where each item comes from", () => {
		const [todoItem, prItem] = buildDeskQueue(
			sources({
				hosts: [host({ todos: [todo({ priority: "high" })], pullRequests: [pr({})] })],
			}),
		);
		expect(todoItem).toMatchObject({
			workspaceName: "Desk",
			projectName: "Superset",
			hostUrl: "h",
			terminalId: "term",
		});
		expect(prItem).toMatchObject({ source: "pr", projectName: "Superset" });
	});
});

describe("isTodoForUser", () => {
	test("the user's own to-dos and what agents leave them count", () => {
		expect(isTodoForUser({ author: "user", kind: "code" })).toBe(true);
		expect(isTodoForUser({ author: "agent", kind: "review" })).toBe(true);
		expect(isTodoForUser({ author: "agent", kind: "other" })).toBe(true);
	});

	test("an agent's code to-do tracks its own work", () => {
		expect(isTodoForUser({ author: "agent", kind: "code" })).toBe(false);
	});
});

describe("readRichTodo", () => {
	test("reads nothing from a to-do of an older host", () => {
		expect(readRichTodo({ text: "Ship" })).toEqual({
			steps: [],
			tracksSteps: false,
			draft: null,
			recipient: null,
			channel: null,
		});
	});

	test("reads steps as text or with their progress, and the draft", () => {
		expect(
			readRichTodo({
				steps: ["Check the address", "", { text: "Send", done: true }, 3],
				draft: "Hi Paul",
				recipient: "Paul",
				channel: 42,
			}),
		).toEqual({
			steps: [
				{ text: "Check the address", done: false },
				{ text: "Send", done: true },
			],
			tracksSteps: true,
			draft: "Hi Paul",
			recipient: "Paul",
			channel: null,
		});
	});
});

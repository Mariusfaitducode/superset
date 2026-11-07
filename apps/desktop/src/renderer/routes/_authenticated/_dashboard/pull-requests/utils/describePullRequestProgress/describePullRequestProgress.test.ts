import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import {
	pullRequestReviewers,
	pullRequestTickets,
	pullRequestTodos,
} from "./describePullRequestProgress";

describe("pullRequestTickets", () => {
	it("lists closed issues, then body links", () => {
		const pr = makeMyPullRequest(
			1,
			{
				closingIssues: [
					{
						number: 2944,
						title: "Group by local day",
						url: "https://github.com/acme/web/issues/2944",
						state: "CLOSED",
					},
				],
			},
			{
				ticketLinks: [
					{
						source: "notion",
						url: "https://app.notion.com/p/1",
						title: "Spec",
					},
				],
			},
		);
		expect(pullRequestTickets(pr)).toEqual([
			{
				source: "github",
				url: "https://github.com/acme/web/issues/2944",
				ref: "#2944",
				title: "Group by local day",
				closed: true,
			},
			{
				source: "notion",
				url: "https://app.notion.com/p/1",
				ref: null,
				title: "Spec",
				closed: false,
			},
		]);
	});

	it("is empty without details or links", () => {
		expect(pullRequestTickets({ details: null })).toEqual([]);
	});
});

describe("pullRequestReviewers", () => {
	it("keeps one state per reviewer, a new request over an old review", () => {
		const pr = makeMyPullRequest(1, {
			reviews: [
				{ login: "vic", state: "APPROVED" },
				{ login: "pb", state: "CHANGES_REQUESTED" },
				{ login: "louis", state: "COMMENTED" },
				{ login: "old", state: "DISMISSED" },
			],
			pendingReviewers: ["Louis", "core"],
		});
		expect(pullRequestReviewers(pr.details)).toEqual([
			{ login: "pb", state: "changes-requested" },
			{ login: "core", state: "requested" },
			{ login: "Louis", state: "requested" },
			{ login: "vic", state: "approved" },
		]);
	});
});

describe("pullRequestTodos", () => {
	const todo = (
		id: string,
		fields: Partial<Parameters<typeof pullRequestTodos>[0][number]>,
	) => ({
		id,
		workspaceId: "ws",
		text: id,
		done: false,
		priority: "normal" as const,
		dueOn: null,
		link: null,
		createdAt: 1,
		...fields,
	});

	it("keeps open to-dos of the workspace or linked to the PR, high priority first", () => {
		const todos = [
			todo("a", {}),
			todo("b", { done: true }),
			todo("c", { workspaceId: "other" }),
			todo("d", {
				workspaceId: "other",
				link: "https://github.com/acme/web/pull/1/",
				priority: "high",
			}),
		];
		expect(
			pullRequestTodos(todos, {
				workspaceId: "ws",
				url: "https://github.com/acme/web/pull/1",
			}).map((item) => item.id),
		).toEqual(["d", "a"]);
		expect(
			pullRequestTodos(todos, {
				workspaceId: null,
				url: "https://github.com/acme/web/pull/2",
			}),
		).toEqual([]);
	});
});

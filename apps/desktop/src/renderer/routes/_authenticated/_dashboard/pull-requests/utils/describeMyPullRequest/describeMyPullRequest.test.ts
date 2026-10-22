import { describe, expect, it } from "bun:test";
import { describeMyPullRequest } from "./describeMyPullRequest";

const green = [{ name: "CI", status: "success" as const, url: null }];
const red = [{ name: "CI", status: "failure" as const, url: null }];
const running = [{ name: "CI", status: "pending" as const, url: null }];

describe("describeMyPullRequest", () => {
	const mine = { isDraft: false, checks: green, viewerIsAuthor: true };

	it("puts every blocker of my own PR on me", () => {
		expect(
			describeMyPullRequest({
				...mine,
				checks: red,
				mergeable: "CONFLICTING",
				reviewDecision: "CHANGES_REQUESTED",
			}),
		).toEqual({
			waitingOnViewer: true,
			reasons: ["conflicts", "ci-failing", "changes-requested"],
		});
	});

	it("says ready to merge once approved and green", () => {
		expect(
			describeMyPullRequest({ ...mine, reviewDecision: "APPROVED" }),
		).toEqual({ waitingOnViewer: true, reasons: ["ready-to-merge"] });
	});

	it("waits on others while CI runs or nobody approved", () => {
		expect(
			describeMyPullRequest({
				...mine,
				checks: running,
				reviewDecision: "REVIEW_REQUIRED",
			}),
		).toEqual({
			waitingOnViewer: false,
			reasons: ["ci-running", "awaiting-review"],
		});
		expect(describeMyPullRequest({ ...mine, reviewDecision: null })).toEqual({
			waitingOnViewer: false,
			reasons: ["awaiting-review"],
		});
	});

	it("keeps a draft on me", () => {
		expect(describeMyPullRequest({ ...mine, isDraft: true })).toEqual({
			waitingOnViewer: true,
			reasons: ["draft"],
		});
	});

	it("puts someone else's PR on me only when my review is requested", () => {
		const theirs = { isDraft: false, checks: red, viewerIsAuthor: false };
		expect(
			describeMyPullRequest({ ...theirs, reviewRequestedFromViewer: true }),
		).toEqual({ waitingOnViewer: true, reasons: ["review-requested"] });
		expect(describeMyPullRequest(theirs)).toEqual({
			waitingOnViewer: false,
			reasons: ["following"],
		});
	});

	it("does not claim authorship when the viewer is unknown", () => {
		expect(
			describeMyPullRequest({
				isDraft: false,
				checks: red,
				viewerIsAuthor: null,
			}),
		).toEqual({ waitingOnViewer: false, reasons: ["following"] });
	});
});

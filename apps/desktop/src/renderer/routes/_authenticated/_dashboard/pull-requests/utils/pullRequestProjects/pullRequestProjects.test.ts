import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import {
	assignPullRequestProject,
	DEFAULT_PULL_REQUEST_PROJECTS,
	matchPullRequestProject,
	OTHER_PROJECT_ID,
	type PullRequestProject,
	parseRuleList,
} from "./pullRequestProjects";

const project = (
	id: string,
	rules: Partial<PullRequestProject> = {},
): PullRequestProject => ({
	id,
	name: id,
	labels: [],
	keywords: [],
	pullRequests: [],
	...rules,
});

const pr = (
	prNumber: number,
	title: string,
	headRefName: string,
	labels: string[] = [],
	repoFullName = "spore-bio/hub",
) =>
	makeMyPullRequest(prNumber, { headRefName }, { title, labels, repoFullName });

describe("matchPullRequestProject", () => {
	it("finds a keyword in the title or the branch, whatever the separator", () => {
		const projects = [
			project("acq", { keywords: ["calibration_acquisition"] }),
		];
		expect(
			matchPullRequestProject(
				pr(1, "drop the calibration-acquisition pivot", "x"),
				projects,
			),
		).toBe("acq");
		expect(
			matchPullRequestProject(
				pr(
					2,
					"refactor",
					"feature/synergy/drop-Calibration-Acquisition-readers",
				),
				projects,
			),
		).toBe("acq");
		expect(
			matchPullRequestProject(pr(3, "calibration", "x"), projects),
		).toBeNull();
	});

	it("matches labels exactly, ignoring case", () => {
		const projects = [project("redesign", { labels: ["Spore-App-Redesign"] })];
		expect(
			matchPullRequestProject(
				pr(1, "t", "b", ["spore-app-redesign"]),
				projects,
			),
		).toBe("redesign");
		expect(
			matchPullRequestProject(
				pr(2, "t", "b", ["spore-app-redesign-2"]),
				projects,
			),
		).toBeNull();
	});

	it("matches PR numbers in any repo, or only in the repo it names", () => {
		const anyRepo = [project("p", { pullRequests: ["#12"] })];
		const oneRepo = [project("p", { pullRequests: ["Spore-Bio/Hub#12"] })];
		expect(matchPullRequestProject(pr(12, "t", "b"), anyRepo)).toBe("p");
		expect(matchPullRequestProject(pr(12, "t", "b"), oneRepo)).toBe("p");
		expect(
			matchPullRequestProject(pr(12, "t", "b", [], "acme/web"), oneRepo),
		).toBeNull();
	});

	it("prefers a PR number over a label over a keyword, then the list order", () => {
		const subject = pr(7, "audit trail", "b", ["redesign"]);
		const keyword = project("keyword", { keywords: ["audit"] });
		const label = project("label", { labels: ["redesign"] });
		const number = project("number", { pullRequests: ["7"] });
		expect(matchPullRequestProject(subject, [keyword, label, number])).toBe(
			"number",
		);
		expect(matchPullRequestProject(subject, [keyword, label])).toBe("label");
		expect(
			matchPullRequestProject(subject, [
				keyword,
				project("second", { keywords: ["trail"] }),
			]),
		).toBe("keyword");
	});

	it("ignores blank rules", () => {
		const projects = [
			project("p", { keywords: [" ", ""], pullRequests: ["#"] }),
		];
		expect(matchPullRequestProject(pr(1, "t", "b"), projects)).toBeNull();
	});
});

describe("assignPullRequestProject", () => {
	const projects = [
		project("a", { keywords: ["alpha"] }),
		project("b", { keywords: ["beta"] }),
	];

	it("lets a move by hand win over the rules", () => {
		const subject = pr(1, "alpha", "x");
		expect(assignPullRequestProject(subject, projects, {})).toBe("a");
		expect(
			assignPullRequestProject(subject, projects, { "spore-bio/hub#1": "b" }),
		).toBe("b");
		expect(
			assignPullRequestProject(subject, projects, {
				"spore-bio/hub#1": OTHER_PROJECT_ID,
			}),
		).toBe(OTHER_PROJECT_ID);
	});

	it("falls back to the rules when the project moved to is gone", () => {
		expect(
			assignPullRequestProject(pr(1, "alpha", "x"), projects, {
				"spore-bio/hub#1": "deleted",
			}),
		).toBe("a");
	});

	it("puts a PR no rule matches in Other", () => {
		expect(assignPullRequestProject(pr(1, "gamma", "x"), projects, {})).toBe(
			OTHER_PROJECT_ID,
		);
	});
});

describe("DEFAULT_PULL_REQUEST_PROJECTS", () => {
	// Open hub PRs at the time the seeds were written.
	const cases: [ReturnType<typeof pr>, string][] = [
		[
			pr(
				2701,
				"refactor(synergy): drop the calibration_acquisition pivot (pivot removal, step 4)",
				"feature/synergy/drop-calibration-acquisition-contract",
			),
			"calibration-acquisition",
		],
		[
			pr(
				3144,
				"chore(platform): read calibration in Grafana through the direct acquisition links",
				"feature/synergy/calibration-direct-links-grafana",
			),
			"calib-tracability",
		],
		[
			pr(
				3198,
				"feat(spore-app): prefill the R&D sample form from Synergy",
				"feature/spore-app/rd-prefill-from-synergy",
			),
			"dg-automation",
		],
		[
			pr(
				3382,
				"feat(dashboard): refuse deletes that would destroy regulated records",
				"feature/dashboard/archive-instead-of-delete",
			),
			"21-cfr-pt-11",
		],
		[
			pr(
				2734,
				"feat(spore-app): operator management and an append-only audit trail",
				"feature/spore-app/redesign-85-operators-audit",
				["app:spore-app", "spore-app-redesign"],
			),
			"spore-app-redesign",
		],
		[
			pr(
				2008,
				"feat(dashboard): count sampling-point compliance per test, not per measurement",
				"feature/dashboard/sampling-point-compliance-stats",
			),
			"scientific-results",
		],
		[
			pr(
				2824,
				"feat(synergy): ML pipeline registry v1",
				"feature/synergy/pipeline-registry",
			),
			"pipeline-registry",
		],
		[
			pr(
				3377,
				"feat(synergy): a Matrices page, with a category, a client and an archive for each matrix",
				"feature/synergy/matrices-page",
			),
			OTHER_PROJECT_ID,
		],
		[
			pr(
				3375,
				"feat(platform): redesign the office TV in the website's look",
				"feature/platform/office-tv-redesign",
			),
			OTHER_PROJECT_ID,
		],
	];

	for (const [subject, expected] of cases) {
		it(`puts #${subject.prNumber} in ${expected}`, () => {
			expect(
				assignPullRequestProject(subject, DEFAULT_PULL_REQUEST_PROJECTS, {}),
			).toBe(expected);
		});
	}
});

describe("parseRuleList", () => {
	it("splits on commas and new lines, trims and drops duplicates", () => {
		expect(parseRuleList("audit trail, e-signature\n\n audit trail ,")).toEqual(
			["audit trail", "e-signature"],
		);
	});
});

import type { MyPullRequestItem } from "../describeMyPullRequest";
import { myPullRequestKey } from "../prioritizeMyPullRequests";

/**
 * A project as the user thinks of it (often several PRs across repos), not a
 * repo. GitHub has no field for it, so PRs are matched by rules.
 */
export interface PullRequestProject {
	id: string;
	name: string;
	/** Exact label names, case-insensitive. */
	labels: string[];
	/** Found in the title or branch; `-`, `_` and spaces count as the same. */
	keywords: string[];
	/** `owner/repo#123`, or `#123` / `123` in any repo. */
	pullRequests: string[];
}

export const OTHER_PROJECT_ID = "other";

// Guesses from the open PRs and workspace names of the first user, who can
// edit or delete them; they only seed a profile that has no projects yet.
export const DEFAULT_PULL_REQUEST_PROJECTS: PullRequestProject[] = [
	{
		id: "pipeline-registry",
		name: "Pipeline Registry",
		labels: [],
		keywords: ["pipeline registry", "pipelines registry"],
		pullRequests: [],
	},
	{
		id: "calib-tracability",
		name: "Calib Tracability",
		labels: [],
		keywords: [
			"acquisition calibration link",
			"calibration direct links",
			"calibration an acquisition",
			"tracability",
			"traceability",
		],
		pullRequests: [],
	},
	{
		id: "scientific-results",
		name: "Scientific Results",
		labels: ["scientific-results-M0", "scientific-results-enforcement"],
		keywords: ["scientific results", "sampling point", "compliance"],
		pullRequests: [],
	},
	{
		id: "calibration-acquisition",
		name: "CalibrationAcquisition",
		labels: [],
		keywords: ["calibration acquisition", "calibrationacquisition", "pivot"],
		pullRequests: [],
	},
	{
		id: "dg-automation",
		name: "DG Automation",
		labels: [],
		keywords: ["datagen", "dg automation", "prefill"],
		pullRequests: [],
	},
	{
		id: "21-cfr-pt-11",
		name: "21 CFR pt 11",
		labels: [],
		keywords: [
			"21 cfr",
			"part 11",
			"audit trail",
			"audit log",
			"e signature",
			"electronic signature",
			"regulated record",
			"archive tests",
			"archive instead of delete",
		],
		pullRequests: [],
	},
	{
		id: "spore-app-redesign",
		name: "Spore-App Redesign",
		labels: ["spore-app-redesign"],
		keywords: ["spore app/redesign"],
		pullRequests: [],
	},
];

type MatchablePullRequest = Pick<
	MyPullRequestItem,
	"repoFullName" | "prNumber" | "title" | "labels" | "details"
>;

function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[\s_-]+/g, " ")
		.trim();
}

function matchesPullRequestRef(pr: MatchablePullRequest, ref: string): boolean {
	const value = ref.trim().toLowerCase().replace(/^#/, "");
	if (!value) return false;
	return value.includes("#")
		? value === myPullRequestKey(pr)
		: value === String(pr.prNumber);
}

/**
 * The project whose rules match, or null. A PR number beats a label, which
 * beats a keyword; on a tie the first project in the list wins.
 */
export function matchPullRequestProject(
	pr: MatchablePullRequest,
	projects: PullRequestProject[],
): string | null {
	const byRef = projects.find((project) =>
		project.pullRequests.some((ref) => matchesPullRequestRef(pr, ref)),
	);
	if (byRef) return byRef.id;

	const labels = new Set((pr.labels ?? []).map((label) => label.toLowerCase()));
	const byLabel = projects.find((project) =>
		project.labels.some((label) => labels.has(label.trim().toLowerCase())),
	);
	if (byLabel) return byLabel.id;

	const haystack = normalize(`${pr.title}\n${pr.details?.headRefName ?? ""}`);
	const byKeyword = projects.find((project) =>
		project.keywords.some((keyword) => {
			const needle = normalize(keyword);
			return needle.length > 0 && haystack.includes(needle);
		}),
	);
	return byKeyword?.id ?? null;
}

/**
 * Where a PR goes: the project it was moved to by hand, else the rules,
 * else Other. A move to a deleted project falls back to the rules.
 */
export function assignPullRequestProject(
	pr: MatchablePullRequest,
	projects: PullRequestProject[],
	overrides: Record<string, string>,
): string {
	const moved = overrides[myPullRequestKey(pr)];
	if (
		moved === OTHER_PROJECT_ID ||
		(moved && projects.some((project) => project.id === moved))
	) {
		return moved;
	}
	return matchPullRequestProject(pr, projects) ?? OTHER_PROJECT_ID;
}

/** Comma- or newline-separated text from the editor, trimmed and deduplicated. */
export function parseRuleList(text: string): string[] {
	return [
		...new Set(
			text
				.split(/[,\n]/)
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

import { z } from "zod";
import { isGithubRateLimitError } from "../../../../runtime/pull-requests/utils/github-errors";
import { protectedProcedure } from "../../../index";
import {
	chunkProjectRepos,
	collectChunkResults,
	githubRequestError,
	resolveProjectRepos,
} from "../shared/github-search";
import {
	buildDetailsQuery,
	chunk,
	DETAILS_BATCH_SIZE,
	type MyPullRequestDetails,
	parseDetailsResponse,
} from "../shared/my-pull-requests";
import {
	defaultMyPullRequestsCachePath,
	MyPullRequestsCache,
} from "../shared/my-pull-requests-cache";
import { resolveGithubRepo } from "../shared/project-helpers";
import type { TicketLink } from "../shared/ticket-links";
import {
	ghApiSearchPullRequests,
	octokitSearchPullRequests,
} from "./search-pull-requests";

export type MyPullRequest = {
	projectId: string;
	repoFullName: string;
	prNumber: number;
	title: string;
	url: string;
	isDraft: boolean;
	authorLogin: string | null;
	updatedAt: string | null;
	ticketLinks: TicketLink[];
	labels: string[];
	/** null when the details call failed or was skipped for this PR. */
	details: MyPullRequestDetails | null;
};

export interface MyPullRequestsResult {
	pullRequests: MyPullRequest[];
	fetchedAt: string;
	/** Some repos or details did not load, or a search hit its page size. */
	incomplete: boolean;
	/** Search only: details are still to come in a full answer. */
	withoutDetails?: boolean;
	timings: { searchMs: number; detailsMs: number; totalMs: number };
}

// GitHub search has no OR: `involves:@me` misses PRs where only my review
// is requested, so each chunk runs both searches.
const RELATIONSHIP_QUALIFIERS = [
	"is:pr is:open involves:@me",
	"is:pr is:open user-review-requested:@me",
];
const SEARCH_PAGE_SIZE = 100;

// Read lazily on the first call, so a test or a host without a home dir
// never touches the disk at import.
let cache: MyPullRequestsCache<MyPullRequestsResult> | null = null;
function lastResults(): MyPullRequestsCache<MyPullRequestsResult> {
	cache ??= new MyPullRequestsCache(defaultMyPullRequestsCachePath());
	return cache;
}

function sortByUpdated(pullRequests: MyPullRequest[]): MyPullRequest[] {
	return pullRequests.sort((a, b) =>
		(b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
	);
}

export const listMyPullRequests = protectedProcedure
	.input(
		z.object({
			projectIds: z.array(z.string()).min(1).max(200),
			/** Answer from memory only, without calling GitHub. */
			cachedOnly: z.boolean().optional(),
			/**
			 * Skip the per-PR details call: about a second instead of several,
			 * for a first paint when nothing is cached. Not cached.
			 */
			withoutDetails: z.boolean().optional(),
		}),
	)
	.query(async ({ ctx, input }): Promise<MyPullRequestsResult | null> => {
		const cacheKey = [...input.projectIds].sort().join(",");
		if (input.cachedOnly) return lastResults().get(cacheKey);
		const startedAt = performance.now();
		const projectRepos = await resolveProjectRepos(
			input.projectIds,
			true,
			(projectId) => resolveGithubRepo(ctx, projectId),
		);
		const empty = (): MyPullRequestsResult => ({
			pullRequests: [],
			fetchedAt: new Date().toISOString(),
			incomplete: false,
			timings: { searchMs: 0, detailsMs: 0, totalMs: 0 },
		});
		if (projectRepos.length === 0) return empty();

		// gh first (the user's own login), Octokit when gh is missing or
		// fails. A rate limit is not retried: it is the same user's quota.
		const ghOrOctokit = async <T>(
			viaGh: () => Promise<T>,
			viaOctokit: (
				octokit: Awaited<ReturnType<typeof ctx.github>>,
			) => Promise<T>,
		): Promise<T> => {
			try {
				return await viaGh();
			} catch (ghError) {
				if (isGithubRateLimitError(ghError)) throw ghError;
				return viaOctokit(await ctx.github());
			}
		};

		try {
			const searches = RELATIONSHIP_QUALIFIERS.flatMap((qualifiers) =>
				chunkProjectRepos(projectRepos, qualifiers).map((repos) =>
					ghOrOctokit(
						() =>
							ghApiSearchPullRequests(
								ctx.execGh,
								repos,
								qualifiers,
								1,
								SEARCH_PAGE_SIZE,
							),
						(octokit) =>
							octokitSearchPullRequests(
								octokit,
								repos,
								qualifiers,
								1,
								SEARCH_PAGE_SIZE,
							),
					),
				),
			);
			const { results: pages, failures: searchFailures } = collectChunkResults(
				await Promise.allSettled(searches),
			);
			const searchMs = performance.now() - startedAt;

			const byKey = new Map<string, MyPullRequest>();
			const repoByProject = new Map(
				projectRepos.map(({ projectId, repo }) => [projectId, repo]),
			);
			for (const item of pages.flatMap((page) => page.items)) {
				const key = `${item.projectId}:${item.prNumber}`;
				const repo = repoByProject.get(item.projectId);
				if (byKey.has(key) || !repo) continue;
				byKey.set(key, {
					projectId: item.projectId,
					repoFullName: `${repo.owner}/${repo.name}`,
					prNumber: item.prNumber,
					title: item.title,
					url: item.url,
					isDraft: item.isDraft,
					authorLogin: item.authorLogin,
					updatedAt: item.updatedAt,
					ticketLinks: item.ticketLinks ?? [],
					labels: item.labels ?? [],
					details: null,
				});
			}

			if (input.withoutDetails) {
				return {
					pullRequests: sortByUpdated([...byKey.values()]),
					fetchedAt: new Date().toISOString(),
					incomplete: searchFailures.length > 0,
					withoutDetails: true,
					timings: {
						searchMs: Math.round(searchMs),
						detailsMs: 0,
						totalMs: Math.round(performance.now() - startedAt),
					},
				};
			}

			const detailsStartedAt = performance.now();
			const batches = projectRepos.flatMap(({ projectId, repo }) =>
				chunk(
					[...byKey.values()]
						.filter((pr) => pr.projectId === projectId)
						.map((pr) => pr.prNumber),
					DETAILS_BATCH_SIZE,
				).map((numbers) => ({ projectId, repo, numbers })),
			);
			const detailResults = await Promise.allSettled(
				batches.map(async ({ projectId, repo, numbers }) => {
					const query = buildDetailsQuery(numbers);
					const variables = { owner: repo.owner, name: repo.name };
					const raw = await ghOrOctokit(
						() =>
							ctx.execGh(
								[
									"api",
									"graphql",
									"-f",
									`query=${query}`,
									"-f",
									`owner=${repo.owner}`,
									"-f",
									`name=${repo.name}`,
								],
								{ cwd: repo.repoPath ?? undefined },
							),
						(octokit) => octokit.graphql(query, variables),
					);
					return { projectId, details: parseDetailsResponse(raw) };
				}),
			);
			let detailFailures = 0;
			for (const result of detailResults) {
				if (result.status === "rejected") {
					detailFailures += 1;
					console.warn(
						"[workspaceCreation.listMyPullRequests] details batch failed",
						result.reason,
					);
					continue;
				}
				const { projectId, details } = result.value;
				for (const [number, value] of details) {
					const pr = byKey.get(`${projectId}:${number}`);
					if (pr) pr.details = value;
				}
			}
			const detailsMs = performance.now() - detailsStartedAt;

			const pullRequests = sortByUpdated([...byKey.values()]);
			const result: MyPullRequestsResult = {
				pullRequests,
				fetchedAt: new Date().toISOString(),
				incomplete:
					searchFailures.length > 0 ||
					detailFailures > 0 ||
					pages.some((page) => page.hasNextPage),
				timings: {
					searchMs: Math.round(searchMs),
					detailsMs: Math.round(detailsMs),
					totalMs: Math.round(performance.now() - startedAt),
				},
			};
			void lastResults().remember(cacheKey, result);
			return result;
		} catch (error) {
			throw githubRequestError(error, ctx.credentials);
		}
	});

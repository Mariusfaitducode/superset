import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { GoGitPullRequest } from "react-icons/go";
import { LuRefreshCw } from "react-icons/lu";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { useDebouncedValue } from "renderer/hooks/useDebouncedValue";
import { pullRequestRefFromUrl } from "renderer/lib/github/pullRequestRef";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { serializeProjectFilters } from "renderer/routes/_authenticated/_dashboard/components/ProjectFilter/project-filter-utils";
import {
	groupProjectTargetsByHost,
	type ProjectQueryTarget,
} from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import { usePullRequestsSplitViewStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsSplitViewStore";
import {
	describeMyPullRequest,
	type MyPullRequestReason,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import {
	branchKey,
	indexWorkspacesByBranch,
	pickWorkspaceConversation,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/matchPullRequestWorkspace";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { PullRequestRow } from "../PullRequestRow";
import { MyPullRequestFooter } from "./components/MyPullRequestFooter";

interface MyPullRequestsContentProps {
	projectFilters: string[];
	projectTargets: ProjectQueryTarget[];
	areProjectsReady: boolean;
	hasProjects: boolean;
	searchQuery: string;
	selectedPrNumber: number | null;
	selectedPrProjectId: string | null;
	repoSlugByProjectId: Map<string, string>;
}

// Two GitHub searches plus one GraphQL call per repo per host, only while
// this view is on screen; react-query also pauses it in a hidden window.
const REFRESH_INTERVAL_MS = 2 * 60_000;
const MINE_LIMIT = 50;

export function MyPullRequestsContent({
	projectFilters,
	projectTargets,
	areProjectsReady,
	hasProjects,
	searchQuery,
	selectedPrNumber,
	selectedPrProjectId,
	repoSlugByProjectId,
}: MyPullRequestsContentProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const expandDetail = usePullRequestsSplitViewStore((s) => s.expandDetail);
	const debouncedQuery = useDebouncedValue(searchQuery, 200);
	const hostTargets = useMemo(
		() => groupProjectTargetsByHost(projectTargets),
		[projectTargets],
	);

	const results = useQueries({
		queries: hostTargets.map((target) => ({
			queryKey: ["pullRequests", "mine", target.key, target.hostUrl],
			queryFn: async () => {
				const firstProject = target.projects[0];
				if (!target.hostUrl || !firstProject) return [];
				const client = getHostServiceClientByUrl(target.hostUrl);
				// GitHub search has no OR: `involves:@me` misses PRs where only
				// my review is requested, so those come from a second search.
				const search = (viewerRelationship: "involved" | "needs-review") =>
					client.workspaceCreation.searchPullRequests.query({
						projectId: firstProject.projectId,
						projectIds: target.projects.map((project) => project.projectId),
						viewerRelationship,
						limit: MINE_LIMIT,
						page: 1,
					});
				const pages = await Promise.all([
					search("needs-review"),
					search("involved"),
				]);
				const byKey = new Map<
					string,
					(typeof pages)[number]["pullRequests"][number]
				>();
				for (const pullRequest of pages.flatMap((page) => page.pullRequests)) {
					const key = `${pullRequest.projectId}:${pullRequest.prNumber}`;
					if (!byKey.has(key)) {
						byKey.set(key, {
							...pullRequest,
							checks: pullRequest.checks ?? [],
						});
					}
				}
				return [...byKey.values()];
			},
			enabled: !!target.hostUrl,
			staleTime: 60_000,
			gcTime: 10 * 60_000,
			refetchInterval: REFRESH_INTERVAL_MS,
		})),
	});

	const isFetching = results.some((result) => result.isFetching);
	const error = results.find((result) => result.error)?.error ?? null;
	const refetch = () => Promise.all(results.map((result) => result.refetch()));

	const { workspaces } = useHostWorkspaces();
	const workspaceByBranch = useMemo(
		() => indexWorkspacesByBranch(workspaces),
		[workspaces],
	);
	const conversations = useAgentConversations();

	const rows = useMemo(() => {
		const query = debouncedQuery.trim().toLowerCase();
		const all = results.flatMap((result) => result.data ?? []);
		return all
			.map((pr) => ({ pr, status: describeMyPullRequest(pr) }))
			.filter(({ pr }) => {
				if (!query) return true;
				const repoSlug = repoSlugByProjectId.get(pr.projectId) ?? "";
				return [pr.title, `#${pr.prNumber}`, pr.headRefName ?? "", repoSlug]
					.join("\n")
					.toLowerCase()
					.includes(query);
			})
			.sort(
				(a, b) =>
					Number(b.status.waitingOnViewer) - Number(a.status.waitingOnViewer) ||
					(b.pr.updatedAt ?? "").localeCompare(a.pr.updatedAt ?? ""),
			);
	}, [results, debouncedQuery, repoSlugByProjectId]);
	const onViewer = rows.filter((row) => row.status.waitingOnViewer);
	const onOthers = rows.filter((row) => !row.status.waitingOnViewer);
	const viewerCount = onViewer.length;
	const othersCount = onOthers.length;

	const reasonLabel: Record<MyPullRequestReason, string> = {
		"review-requested": t`Review requested`,
		conflicts: t`Conflicts`,
		"ci-failing": t`CI failing`,
		"changes-requested": t`Changes requested`,
		draft: t`Draft`,
		"ready-to-merge": t`Ready to merge`,
		"ci-running": t`CI running`,
		"awaiting-review": t`Waiting for review`,
		following: t`Following`,
	};

	const handleOpenPreview = (pr: (typeof rows)[number]["pr"]) => {
		expandDetail();
		navigate({
			to: "/pull-requests/$prNumber",
			params: { prNumber: String(pr.prNumber) },
			search: {
				search: searchQuery || undefined,
				project: pr.projectId,
				repo: pullRequestRefFromUrl(pr.url)?.repoFullName,
				projects: serializeProjectFilters(projectFilters),
				state: "mine",
			},
		});
	};

	const openConversation = (conversation: AgentConversation) => {
		void navigateToV2Workspace(conversation.workspaceId, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	if (projectTargets.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
					<GoGitPullRequest className="size-8" />
					<span className="max-w-prose text-sm text-wrap-pretty">
						{areProjectsReady ? (
							hasProjects ? (
								<Trans>Select a project to see pull requests.</Trans>
							) : (
								<Trans>Add a project to see pull requests.</Trans>
							)
						) : (
							<Trans>Loading projects…</Trans>
						)}
					</span>
				</div>
			</div>
		);
	}

	const isInitialLoad = isFetching && rows.length === 0;
	const renderSection = (title: string, sectionRows: typeof rows): ReactNode =>
		sectionRows.length > 0 && (
			<section className="flex flex-col gap-1.5">
				<h3 className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">
					{title} <span className="tabular-nums">{sectionRows.length}</span>
				</h3>
				{sectionRows.map(({ pr, status }) => {
					const workspace = pr.headRefName
						? workspaceByBranch.get(branchKey(pr.projectId, pr.headRefName))
						: undefined;
					const conversation = workspace
						? pickWorkspaceConversation(conversations, workspace.id)
						: null;
					return (
						<PullRequestRow
							key={`${pr.projectId}:${pr.prNumber}`}
							pr={pr}
							repoSlug={repoSlugByProjectId.get(pr.projectId)}
							isSelected={
								selectedPrNumber === pr.prNumber &&
								(selectedPrProjectId == null ||
									selectedPrProjectId === pr.projectId)
							}
							onClick={() => handleOpenPreview(pr)}
							footer={
								<MyPullRequestFooter
									status={status}
									reasonLabel={reasonLabel}
									workspace={workspace}
									conversation={conversation}
									onOpenWorkspace={(workspaceId) =>
										void navigateToV2Workspace(workspaceId, navigate)
									}
									onOpenConversation={openConversation}
								/>
							}
						/>
					);
				})}
			</section>
		);

	return (
		<div
			className="@container flex h-full flex-col overflow-hidden"
			aria-busy={isFetching}
		>
			<div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-4 py-2">
				<GoGitPullRequest className="size-3.5 text-muted-foreground" />
				<span className="text-xs text-muted-foreground" aria-live="polite">
					{isInitialLoad ? (
						<Trans>Loading…</Trans>
					) : (
						<Trans>
							{viewerCount} waiting on you · {othersCount} on others
						</Trans>
					)}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					className="ml-auto"
					title={t`Refresh`}
					aria-label={t`Refresh pull requests`}
					disabled={isFetching}
					onClick={() => refetch()}
				>
					<LuRefreshCw
						className={
							isFetching
								? "size-3.5 animate-spin motion-reduce:animate-none"
								: "size-3.5"
						}
					/>
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{error && rows.length === 0 ? (
					<div className="flex cursor-text select-text flex-col items-start gap-3 px-4 py-4 text-sm text-destructive">
						<span>{error.message}</span>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<Trans>Try again</Trans>
						</Button>
					</div>
				) : isInitialLoad ? (
					<div className="flex h-full items-center justify-center gap-2 p-8 text-muted-foreground">
						<LuRefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
						<span className="text-sm">
							<Trans>Loading pull requests…</Trans>
						</span>
					</div>
				) : rows.length === 0 ? (
					<div className="flex h-full items-center justify-center p-8">
						<span className="text-sm text-muted-foreground">
							<Trans>No open pull requests involve you.</Trans>
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-3 p-2">
						{error && (
							<div className="flex items-center gap-2 rounded-lg bg-destructive/5 px-4 py-2 text-xs text-destructive">
								<span className="min-w-0 flex-1 cursor-text select-text truncate">
									<Trans>
										Some repositories could not be loaded: {error.message}
									</Trans>
								</span>
								<Button variant="outline" size="xs" onClick={() => refetch()}>
									<Trans>Retry</Trans>
								</Button>
							</div>
						)}
						{renderSection(t`Waiting on you`, onViewer)}
						{renderSection(t`Waiting on others`, onOthers)}
					</div>
				)}
			</div>
		</div>
	);
}

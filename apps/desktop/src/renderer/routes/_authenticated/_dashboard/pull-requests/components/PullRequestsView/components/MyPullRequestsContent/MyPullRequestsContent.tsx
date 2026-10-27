import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { GoGitPullRequest } from "react-icons/go";
import { LuRefreshCw } from "react-icons/lu";
import {
	type ConversationTodo,
	fetchHostConversationTodos,
	hostConversationTodosQueryKey,
} from "renderer/hooks/host-service/useHostConversationTodos";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { useDebouncedValue } from "renderer/hooks/useDebouncedValue";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { serializeProjectFilters } from "renderer/routes/_authenticated/_dashboard/components/ProjectFilter/project-filter-utils";
import {
	groupProjectTargetsByHost,
	type HostQueryTarget,
	type ProjectQueryTarget,
} from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import { useMyPullRequestsStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import { usePullRequestsSplitViewStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsSplitViewStore";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import { pullRequestTodos } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describePullRequestProgress";
import {
	filterMyPullRequests,
	type MyPullRequestStateFilter,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/filterMyPullRequests";
import { groupMyPullRequestsByProject } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/groupMyPullRequestsByProject";
import {
	branchKey,
	indexWorkspacesByBranch,
	pickWorkspaceConversation,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/matchPullRequestWorkspace";
import {
	type PrioritizedPullRequest,
	prioritizeMyPullRequests,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/prioritizeMyPullRequests";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	MY_PULL_REQUEST_COLUMNS,
	MyPullRequestRow,
} from "./components/MyPullRequestRow";
import { MyPullRequestStatusLine } from "./components/MyPullRequestStatusLine";
import { MyPullRequestsFilterBar } from "./components/MyPullRequestsFilterBar";
import { actionLabels } from "./utils/myPullRequestLabels";

interface MyPullRequestsContentProps {
	projectFilters: string[];
	projectTargets: ProjectQueryTarget[];
	areProjectsReady: boolean;
	hasProjects: boolean;
	searchQuery: string;
	selectedPrNumber: number | null;
	selectedPrProjectId: string | null;
}

// Two GitHub searches plus one GraphQL call per 10 PRs, per host, only
// while this view is on screen; react-query also pauses it in a hidden window.
const REFRESH_INTERVAL_MS = 2 * 60_000;

const SUMMARY_STATES: MyPullRequestStateFilter[] = [
	"review-requested",
	"changes-requested",
	"ci-failing",
	"conflicts",
	"ready-to-merge",
];

function listMine(target: HostQueryTarget, cachedOnly: boolean) {
	if (!target.hostUrl) return Promise.resolve(null);
	return getHostServiceClientByUrl(
		target.hostUrl,
	).workspaceCreation.listMyPullRequests.query({
		projectIds: target.projects.map((project) => project.projectId),
		cachedOnly,
	});
}

export function MyPullRequestsContent({
	projectFilters,
	projectTargets,
	areProjectsReady,
	hasProjects,
	searchQuery,
	selectedPrNumber,
	selectedPrProjectId,
}: MyPullRequestsContentProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const expandDetail = usePullRequestsSplitViewStore((s) => s.expandDetail);
	const debouncedQuery = useDebouncedValue(searchQuery, 200);
	const hostTargets = useMemo(
		() =>
			groupProjectTargetsByHost(projectTargets).filter(
				(target) => target.projects.length > 0,
			),
		[projectTargets],
	);
	const openUrl = electronTrpc.external.openUrl.useMutation();

	// The host keeps its last answer in memory: show it at once, then let the
	// GitHub round trip (several seconds) replace it.
	const cachedResults = useQueries({
		queries: hostTargets.map((target) => ({
			queryKey: ["pullRequests", "mine", "cached", target.key, target.hostUrl],
			queryFn: () => listMine(target, true),
			enabled: !!target.hostUrl,
			staleTime: Number.POSITIVE_INFINITY,
			gcTime: 10 * 60_000,
		})),
	});
	const results = useQueries({
		queries: hostTargets.map((target) => ({
			queryKey: ["pullRequests", "mine", target.key, target.hostUrl],
			queryFn: () => listMine(target, false),
			enabled: !!target.hostUrl,
			staleTime: 60_000,
			gcTime: 10 * 60_000,
			refetchInterval: REFRESH_INTERVAL_MS,
		})),
	});
	const shown = hostTargets.map(
		(_, index) => results[index]?.data ?? cachedResults[index]?.data ?? null,
	);

	const isFetching = results.some((result) => result.isFetching);
	const error = results.find((result) => result.error)?.error ?? null;
	const refetch = () => Promise.all(results.map((result) => result.refetch()));

	const pullRequests: MyPullRequestItem[] = shown.flatMap(
		(result) => result?.pullRequests ?? [],
	);
	const oldestFetchedAt = shown.reduce<string | null>(
		(oldest, result) =>
			result && (!oldest || result.fetchedAt < oldest)
				? result.fetchedAt
				: oldest,
		null,
	);
	const timings = shown.find((result) => result)?.timings ?? null;
	const isIncomplete = shown.some((result) => result?.incomplete);
	const hasData = shown.some((result) => result !== null);

	// Logged in the renderer console so before/after numbers come from the
	// real app rather than from a benchmark.
	const mountedAt = useRef(performance.now());
	const logged = useRef({ first: false, fresh: false });
	const hasFresh = results.some((result) => result.data);
	useEffect(() => {
		if (!logged.current.first && hasData) {
			logged.current.first = true;
			console.info(
				`[pull-requests:mine] first list after ${Math.round(performance.now() - mountedAt.current)} ms (${hasFresh ? "GitHub" : "host cache"})`,
			);
		}
		if (!logged.current.fresh && hasFresh) {
			logged.current.fresh = true;
			console.info(
				`[pull-requests:mine] fresh list after ${Math.round(performance.now() - mountedAt.current)} ms`,
				timings,
			);
		}
	}, [hasData, hasFresh, timings]);

	const filters = useMyPullRequestsStore();
	const { pinned, later, togglePinned, toggleLater, toggleState, groupBy } =
		filters;
	const byProject = groupBy === "project";

	const dataVersion = shown.map((result) => result?.fetchedAt).join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: pullRequests is rebuilt every render; dataVersion tracks when it really changes
	const { visible, counts } = useMemo(() => {
		const query = debouncedQuery.trim().toLowerCase();
		const matching = query
			? pullRequests.filter((pr) =>
					[
						pr.title,
						`#${pr.prNumber}`,
						pr.details?.headRefName ?? "",
						pr.repoFullName,
						pr.authorLogin ?? "",
					]
						.join("\n")
						.toLowerCase()
						.includes(query),
				)
			: pullRequests;
		return filterMyPullRequests(
			matching,
			{
				repos: filters.repos,
				roles: filters.roles,
				states: filters.states,
				age: filters.age,
			},
			Date.now(),
		);
	}, [
		dataVersion,
		debouncedQuery,
		filters.repos,
		filters.roles,
		filters.states,
		filters.age,
	]);
	const groups = useMemo(
		() => prioritizeMyPullRequests(visible, { pinned, later }),
		[visible, pinned, later],
	);
	const projectGroups = useMemo(
		() => (byProject ? groupMyPullRequestsByProject(groups) : []),
		[byProject, groups],
	);
	const projectNames = useMemo(
		() =>
			new Map(
				projectTargets.map((project) => [
					project.projectId,
					project.projectName,
				]),
			),
		[projectTargets],
	);
	const onViewerCount = groups
		.filter((group) => group.action !== "later")
		.flatMap((group) => group.rows)
		.filter((row) => row.status.waitingOnViewer).length;

	const { workspaces } = useHostWorkspaces();
	const workspaceByBranch = useMemo(
		() => indexWorkspacesByBranch(workspaces),
		[workspaces],
	);
	const conversations = useAgentConversations();
	// Same per-host query as the sidebar, so it is usually already cached.
	const todoResults = useQueries({
		queries: hostTargets.map((target) => ({
			queryKey: hostConversationTodosQueryKey(target.hostUrl),
			queryFn: () =>
				target.hostUrl
					? fetchHostConversationTodos(target.hostUrl)
					: Promise.resolve(null),
			enabled: byProject && !!target.hostUrl,
			refetchInterval: 60_000,
			staleTime: 5_000,
		})),
	});
	const todosVersion = todoResults
		.map((result) => result.dataUpdatedAt)
		.join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: todoResults is a new array every render; todosVersion tracks its data
	const allTodos = useMemo<ConversationTodo[]>(
		() => todoResults.flatMap((result) => result.data ?? []),
		[todosVersion],
	);
	const groupLabel = actionLabels();
	const summaryLabel: Record<MyPullRequestStateFilter, (n: number) => string> =
		{
			"review-requested": (n) => t`${n} to review`,
			"changes-requested": (n) => t`${n} changes requested`,
			"ci-failing": (n) => t`${n} CI failing`,
			conflicts: (n) => t`${n} with conflicts`,
			"ready-to-merge": (n) => t`${n} ready to merge`,
			draft: (n) => t`${n} drafts`,
		};

	const handleOpenPreview = (pr: MyPullRequestItem) => {
		expandDetail();
		navigate({
			to: "/pull-requests/$prNumber",
			params: { prNumber: String(pr.prNumber) },
			search: {
				search: searchQuery || undefined,
				project: pr.projectId,
				repo: pr.repoFullName,
				projects: serializeProjectFilters(projectFilters),
				state: "mine",
			},
		});
	};

	const renderRow = (row: PrioritizedPullRequest) => {
		const { pr } = row;
		const headRefName = pr.details?.headRefName;
		const workspace = headRefName
			? workspaceByBranch.get(branchKey(pr.projectId, headRefName))
			: undefined;
		const conversation = workspace
			? pickWorkspaceConversation(conversations, workspace.id)
			: null;
		return (
			<MyPullRequestRow
				key={row.key}
				row={row}
				isSelected={
					selectedPrNumber === pr.prNumber &&
					(selectedPrProjectId == null || selectedPrProjectId === pr.projectId)
				}
				isPinned={pinned.includes(row.key)}
				isLater={later.includes(row.key)}
				workspace={workspace}
				conversation={conversation}
				onOpen={() => handleOpenPreview(pr)}
				onTogglePinned={() => togglePinned(row.key)}
				onToggleLater={() => toggleLater(row.key)}
				onOpenOnGitHub={() => openUrl.mutate(pr.url)}
				onOpenWorkspace={(workspaceId) =>
					void navigateToV2Workspace(workspaceId, navigate)
				}
				onOpenConversation={openConversation}
				statusLine={
					byProject ? (
						<MyPullRequestStatusLine
							pr={pr}
							conversation={conversation}
							todos={pullRequestTodos(allTodos, {
								workspaceId: workspace?.id ?? null,
								url: pr.url,
							})}
							onOpenUrl={(url) => openUrl.mutate(url)}
							onOpenConversation={openConversation}
						/>
					) : undefined
				}
			/>
		);
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

	const isInitialLoad = !hasData && (isFetching || !error);
	const updatedAgo = oldestFetchedAt
		? formatRelativeTime(Date.parse(oldestFetchedAt))
		: null;
	const timingsTitle = timings
		? t`GitHub: search ${timings.searchMs} ms, details ${timings.detailsMs} ms, total ${timings.totalMs} ms`
		: undefined;

	return (
		<div
			className="@container flex h-full flex-col overflow-hidden"
			aria-busy={isFetching}
		>
			<div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
				<span className="shrink-0 font-medium" aria-live="polite">
					{isInitialLoad ? (
						<Trans>Loading…</Trans>
					) : (
						<Trans>{onViewerCount} waiting on you</Trans>
					)}
				</span>
				<div className="flex min-w-0 flex-wrap items-center gap-x-1 text-muted-foreground">
					{SUMMARY_STATES.filter((state) => counts.states[state] > 0).map(
						(state) => (
							<button
								key={state}
								type="button"
								className={cn(
									"rounded px-1 hover:bg-accent hover:text-foreground",
									filters.states.includes(state) && "bg-accent text-foreground",
								)}
								onClick={() => toggleState(state)}
							>
								<span className="mr-1">·</span>
								{summaryLabel[state](counts.states[state])}
							</button>
						),
					)}
				</div>
				<span
					className="ml-auto shrink-0 text-muted-foreground tabular-nums"
					title={timingsTitle}
				>
					{isFetching && hasData ? (
						<Trans>Refreshing…</Trans>
					) : updatedAgo ? (
						<Trans>Updated {updatedAgo} ago</Trans>
					) : null}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
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
			<MyPullRequestsFilterBar counts={counts} />

			<div className="min-h-0 flex-1 overflow-y-auto">
				{error && !hasData ? (
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
				) : groups.length === 0 ? (
					<div className="flex h-full items-center justify-center p-8">
						<span className="text-sm text-muted-foreground">
							{pullRequests.length === 0 ? (
								<Trans>No open pull requests involve you.</Trans>
							) : (
								<Trans>No pull request matches these filters.</Trans>
							)}
						</span>
					</div>
				) : (
					<div className="flex flex-col pb-2">
						{(error || isIncomplete) && (
							<div className="mx-2 mt-2 flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
								<span className="min-w-0 flex-1 cursor-text select-text truncate">
									{error ? (
										<Trans>Refresh failed: {error.message}</Trans>
									) : (
										<Trans>
											Some repositories or details did not load; the list may be
											incomplete.
										</Trans>
									)}
								</span>
								<Button variant="outline" size="xs" onClick={() => refetch()}>
									<Trans>Retry</Trans>
								</Button>
							</div>
						)}
						<div className="sticky top-0 z-10 flex h-6 items-center gap-2 border-b bg-background px-4 text-[10px] text-muted-foreground uppercase tracking-wide">
							<span className="w-4 shrink-0" />
							<span className="w-3.5 shrink-0" />
							<span className="min-w-0 flex-1">
								<Trans>Pull request</Trans>
							</span>
							<span className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.why)}>
								<Trans>Why here</Trans>
							</span>
							<span className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.ci)}>
								<Trans>CI</Trans>
							</span>
							<span
								className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.review)}
								title={t`Review`}
							>
								<Trans>Rev</Trans>
							</span>
							<span
								className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.conflicts)}
							/>
							<span
								className={cn(
									"shrink-0 text-right",
									MY_PULL_REQUEST_COLUMNS.size,
								)}
								title={t`Lines changed`}
							>
								<Trans>Size</Trans>
							</span>
							<span
								className={cn(
									"shrink-0 text-right",
									MY_PULL_REQUEST_COLUMNS.age,
								)}
								title={t`Opened`}
							>
								<Trans>Age</Trans>
							</span>
							<span
								className={cn(
									"shrink-0 text-right",
									MY_PULL_REQUEST_COLUMNS.activity,
								)}
								title={t`Last activity`}
							>
								<Trans>Act.</Trans>
							</span>
							<span
								className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.who)}
								title={t`Who waits on you, or whom you wait on`}
							>
								<Trans>Who</Trans>
							</span>
							<span className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.link)} />
							<span className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.menu)} />
						</div>
						{byProject
							? projectGroups.map((project) => (
									<section key={project.key} className="flex flex-col px-2">
										<h3 className="flex items-baseline gap-2 px-2 pt-3 pb-1 text-[11px]">
											<span className="font-medium text-foreground">
												{projectNames.get(project.projectId) ??
													project.repoFullName}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{project.rows.length}
											</span>
											<span className="truncate text-muted-foreground/70">
												{[
													project.repoFullName,
													project.onViewer > 0 &&
														t`${project.onViewer} waiting on you`,
													project.toReview > 0 &&
														t`${project.toReview} to review`,
													project.toFix > 0 && t`${project.toFix} to fix`,
													project.toMerge > 0 && t`${project.toMerge} to merge`,
												]
													.filter(Boolean)
													.join(" · ")}
											</span>
										</h3>
										{project.rows.map(renderRow)}
									</section>
								))
							: groups.map((group) => (
									<section key={group.action} className="flex flex-col px-2">
										<h3 className="flex items-baseline gap-2 px-2 pt-3 pb-1 text-[11px]">
											<span className="font-medium text-foreground">
												{groupLabel[group.action].title}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{group.rows.length}
											</span>
											<span className="truncate text-muted-foreground/70">
												{groupLabel[group.action].hint}
											</span>
										</h3>
										{group.rows.map(renderRow)}
									</section>
								))}
					</div>
				)}
			</div>
		</div>
	);
}

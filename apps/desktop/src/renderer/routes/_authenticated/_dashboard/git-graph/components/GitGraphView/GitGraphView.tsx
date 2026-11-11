import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { cn } from "@superset/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	LuChevronDown,
	LuChevronUp,
	LuFolderGit2,
	LuGitGraph,
	LuRefreshCw,
	LuSearch,
} from "react-icons/lu";
import { resolveProjectIconUrl } from "renderer/hooks/host-projects/resolveProjectIconUrl";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { useProjectQueryTargets } from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useGitGraphStore } from "../../stores/gitGraphStore";
import { type BranchPlace, buildRefBadges } from "../../utils/buildRefBadges";
import { indexBranchPlaces } from "../../utils/indexBranchPlaces";
import { layoutGitGraph } from "../../utils/layoutGitGraph";
import {
	GitGraphCell,
	GRAPH_LANE_WIDTH,
	GRAPH_ROW_HEIGHT,
} from "../GitGraphCell";
import {
	COMMIT_DETAILS_HEIGHT,
	GitGraphCommitDetails,
} from "../GitGraphCommitDetails";
import { GitGraphRefFilter, type RefOption } from "../GitGraphRefFilter";
import { type GitGraphRepo, GitGraphRepoPicker } from "../GitGraphRepoPicker";
import {
	GIT_GRAPH_COLUMNS,
	type GitGraphBadge,
	GitGraphRow,
} from "../GitGraphRow";

const PAGE_SIZE = 1_000;
const MAX_COMMITS = 5_000;
// Past this many lanes the graph column scrolls its content out of view
// rather than squeezing the descriptions.
const MAX_VISIBLE_LANES = 14;
const UNCOMMITTED = "*uncommitted*";

const NO_PLACE: BranchPlace<never, never> = {
	worktreePath: null,
	workspace: null,
	conversation: null,
};

export function GitGraphView() {
	const { t } = useLingui();
	const navigate = useNavigate();
	const { projects, targets, isReady } = useProjectQueryTargets([]);
	const store = useGitGraphStore();

	const repos = useMemo<GitGraphRepo[]>(() => {
		const byKey = new Map(
			projects.map((project) => [project.projectKey, project]),
		);
		const recentRank = new Map(
			store.recentProjectIds.map((id, index) => [id, index]),
		);
		return targets
			.map((target) => {
				const project = byKey.get(target.projectId);
				return {
					projectId: target.projectId,
					name: target.projectName,
					iconUrl: project ? resolveProjectIconUrl(project) : null,
					color: project?.color ?? null,
					repoPath: project?.repoPath ?? null,
					available: !!target.hostUrl,
					isRecent: recentRank.has(target.projectId),
				};
			})
			.sort(
				(a, b) =>
					(recentRank.get(a.projectId) ?? Number.POSITIVE_INFINITY) -
						(recentRank.get(b.projectId) ?? Number.POSITIVE_INFINITY) ||
					Number(b.available) - Number(a.available) ||
					a.name.localeCompare(b.name),
			);
	}, [projects, targets, store.recentProjectIds]);

	// The remembered repository, else the most recent one that can be read.
	const target =
		targets.find((item) => item.projectId === store.projectId) ??
		targets.find(
			(item) =>
				item.projectId === repos.find((repo) => repo.available)?.projectId,
		) ??
		targets[0] ??
		null;
	const projectId = target?.projectId ?? null;
	const hostUrl = target?.hostUrl ?? null;
	const repoUrl =
		projects.find((project) => project.projectKey === projectId)?.repoUrl ??
		null;
	const selectedRefs = projectId ? (store.refsByProject[projectId] ?? []) : [];
	const [limit, setLimit] = useState(PAGE_SIZE);
	const [search, setSearch] = useState("");
	const [selectedHash, setSelectedHash] = useState<string | null>(null);
	const [matchCursor, setMatchCursor] = useState(0);

	const client = hostUrl ? getHostServiceClientByUrl(hostUrl) : null;
	// Queries are only enabled once both exist.
	const requireClient = () => {
		if (!client) throw new Error("No host for this project");
		return client;
	};
	const requireProject = () => {
		if (!projectId) throw new Error("No project selected");
		return projectId;
	};
	const overview = useQuery({
		queryKey: ["gitGraph", "overview", projectId, hostUrl],
		queryFn: () =>
			requireClient().gitGraph.overview.query({ projectId: requireProject() }),
		enabled: !!client && !!projectId,
		staleTime: 30_000,
	});

	const { workspaces } = useHostWorkspaces();
	const conversations = useAgentConversations();
	const places = useMemo(
		() =>
			projectId
				? indexBranchPlaces({
						projectId,
						worktrees: overview.data?.worktrees ?? [],
						workspaces,
						conversations,
					})
				: new Map(),
		[projectId, overview.data?.worktrees, workspaces, conversations],
	);

	const refOptions = useMemo<RefOption[]>(
		() =>
			(overview.data?.refs ?? []).map((ref) => {
				const place = ref.kind === "branch" ? places.get(ref.shortName) : null;
				return {
					ref: ref.name,
					label: ref.shortName,
					kind: ref.kind,
					committedAt: ref.committedAt,
					hasWorktree: !!(place?.worktreePath || place?.workspace),
					conversationTitle: place?.conversation?.title ?? null,
				};
			}),
		[overview.data?.refs, places],
	);
	const worktreeRefs = useMemo(
		() =>
			refOptions
				.filter(
					(option) =>
						option.kind === "branch" &&
						(option.hasWorktree || option.conversationTitle),
				)
				.map((option) => option.ref),
		[refOptions],
	);
	const walkedRefs =
		store.worktreesOnly && worktreeRefs.length > 0
			? worktreeRefs
			: selectedRefs;

	const log = useQuery({
		queryKey: [
			"gitGraph",
			"log",
			projectId,
			hostUrl,
			walkedRefs,
			store.showRemotes,
			store.showTags,
			limit,
		],
		queryFn: () =>
			requireClient().gitGraph.log.query({
				projectId: requireProject(),
				refs: walkedRefs,
				includeRemotes: store.showRemotes,
				includeTags: store.showTags,
				limit,
			}),
		enabled:
			!!client && !!projectId && (!store.worktreesOnly || !!overview.data),
		staleTime: 30_000,
		placeholderData: (previous) => previous,
	});

	const commits = useMemo(() => log.data?.commits ?? [], [log.data]);
	const headBranch = overview.data?.headBranch ?? null;
	const uncommitted = overview.data?.uncommittedCount ?? 0;
	const headHash =
		commits.find((commit) => commit.refs.includes("HEAD"))?.hash ?? null;
	// Uncommitted changes sit on top, linked to HEAD by a dashed line.
	const showUncommitted = uncommitted > 0 && headHash !== null;
	const offset = showUncommitted ? 1 : 0;
	const layout = useMemo(
		() =>
			layoutGitGraph(
				showUncommitted && headHash
					? [
							{ hash: UNCOMMITTED, parents: [headHash], dashed: true },
							...commits,
						]
					: commits,
			),
		[commits, showUncommitted, headHash],
	);
	const maxLanes = layout.reduce((max, row) => Math.max(max, row.width), 1);
	const graphWidth =
		Math.min(maxLanes, MAX_VISIBLE_LANES) * GRAPH_LANE_WIDTH + 8;

	const placeOf = useCallback(
		(branch: string) => places.get(branch) ?? NO_PLACE,
		[places],
	);
	const badges = useMemo(
		() =>
			commits.map(
				(commit) =>
					buildRefBadges(commit.refs, {
						showRemotes: store.showRemotes,
						showTags: store.showTags,
						placeOf,
					}) as GitGraphBadge[],
			),
		[commits, store.showRemotes, store.showTags, placeOf],
	);

	const needle = search.trim().toLowerCase();
	const matches = useMemo(() => {
		if (!needle) return [];
		return commits.flatMap((commit, index) =>
			commit.subject.toLowerCase().includes(needle) ||
			commit.hash.startsWith(needle) ||
			commit.authorName.toLowerCase().includes(needle) ||
			commit.refs.some((ref) => ref.toLowerCase().includes(needle))
				? [index]
				: [],
		);
	}, [commits, needle]);
	const matchSet = useMemo(() => new Set(matches), [matches]);

	const selectedIndex = useMemo(() => {
		if (!selectedHash) return -1;
		return commits.findIndex((commit) => commit.hash === selectedHash);
	}, [commits, selectedHash]);

	const scrollRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const virtualizer = useVirtualizer({
		count: commits.length + offset,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) =>
			GRAPH_ROW_HEIGHT +
			(selectedIndex >= 0 && index === selectedIndex + offset
				? COMMIT_DETAILS_HEIGHT
				: 0),
		overscan: 20,
	});
	// Row heights change when the details open, close or move.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure on these changes only
	useEffect(() => {
		virtualizer.measure();
	}, [selectedIndex, offset, virtualizer]);

	const selectIndex = useCallback(
		(index: number) => {
			const commit = commits[index];
			if (!commit) return;
			setSelectedHash(commit.hash);
			virtualizer.scrollToIndex(index + offset, { align: "auto" });
		},
		[commits, offset, virtualizer],
	);
	const selectHash = useCallback(
		(hash: string) => {
			const index = commits.findIndex((commit) => commit.hash === hash);
			if (index !== -1) selectIndex(index);
		},
		[commits, selectIndex],
	);

	const jumpToMatch = (step: number) => {
		if (matches.length === 0) return;
		const next = (matchCursor + step + matches.length) % matches.length;
		setMatchCursor(next);
		const index = matches[next] as number;
		setSelectedHash(commits[index]?.hash ?? null);
		virtualizer.scrollToIndex(index + offset, { align: "center" });
	};
	useEffect(() => {
		setMatchCursor(0);
		const first = matches[0];
		if (first !== undefined) {
			virtualizer.scrollToIndex(first + offset, { align: "center" });
		}
	}, [matches, offset, virtualizer]);

	// A new repo or filter starts from the first page again.
	const filterKey = `${projectId}|${walkedRefs.join(",")}|${store.showRemotes}|${store.showTags}`;
	const lastFilterKey = useRef(filterKey);
	useEffect(() => {
		if (lastFilterKey.current !== filterKey) {
			lastFilterKey.current = filterKey;
			setLimit(PAGE_SIZE);
			setSelectedHash(null);
		}
	}, [filterKey]);

	const openConversation = useCallback(
		(conversation: AgentConversation) => {
			void navigateToV2Workspace(conversation.workspaceId, navigate, {
				search: {
					terminalId: conversation.terminalId,
					focusRequestId: crypto.randomUUID(),
				},
			});
		},
		[navigate],
	);
	const openWorkspace = useCallback(
		(workspaceId: string) => void navigateToV2Workspace(workspaceId, navigate),
		[navigate],
	);
	const filterRef = useCallback(
		(ref: string) => {
			if (!projectId) return;
			store.setWorktreesOnly(false);
			store.setRefs(projectId, [ref]);
		},
		[projectId, store],
	);
	const toggleSelected = useCallback(
		(hash: string) =>
			setSelectedHash((current) => (current === hash ? null : hash)),
		[],
	);

	const refresh = () => {
		void overview.refetch();
		void log.refetch();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "f") {
			event.preventDefault();
			searchRef.current?.focus();
			searchRef.current?.select();
			return;
		}
		if (event.target instanceof HTMLInputElement) return;
		if (event.key === "Escape" && selectedHash) {
			event.preventDefault();
			setSelectedHash(null);
		} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			selectIndex(
				selectedIndex === -1
					? 0
					: Math.min(Math.max(selectedIndex + step, 0), commits.length - 1),
			);
		}
	};

	if (isReady && targets.length === 0) {
		return (
			<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
				<PageHeader />
				<div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
					<Trans>Add a project to see its git graph.</Trans>
				</div>
			</div>
		);
	}

	const error = log.error ?? overview.error;
	const unavailable = isReady && target !== null && !hostUrl;

	return (
		// `flex-1 w-full`: with `@container` the width no longer follows the
		// content, so without them the page collapses to zero width.
		// biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the whole page
		<div
			className="@container flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden"
			onKeyDown={onKeyDown}
		>
			<PageHeader />
			<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 text-xs">
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground">
						<Trans>Repo:</Trans>
					</span>
					<GitGraphRepoPicker
						repos={repos}
						value={projectId}
						onChange={(value) => store.setProjectId(value)}
					/>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground">
						<Trans>Branches:</Trans>
					</span>
					<GitGraphRefFilter
						options={refOptions.filter(
							(option) =>
								(store.showRemotes || option.kind !== "remote") &&
								(store.showTags || option.kind !== "tag"),
						)}
						selected={selectedRefs}
						onChange={(refs) => {
							if (!projectId) return;
							store.setWorktreesOnly(false);
							store.setRefs(projectId, refs);
						}}
					/>
				</div>
				<Button
					variant={store.worktreesOnly ? "secondary" : "ghost"}
					size="sm"
					className="h-7 gap-1.5 px-2 text-xs"
					aria-pressed={store.worktreesOnly}
					title={t`Only branches with a worktree or a conversation`}
					onClick={() => store.setWorktreesOnly(!store.worktreesOnly)}
				>
					<LuFolderGit2 className="size-3.5" />
					<Trans>My worktrees</Trans>
					<span className="text-muted-foreground tabular-nums">
						{worktreeRefs.length}
					</span>
				</Button>
				<label className="flex items-center gap-1.5">
					<input
						type="checkbox"
						checked={store.showRemotes}
						onChange={(event) => store.setShowRemotes(event.target.checked)}
					/>
					<Trans>Show Remote Branches</Trans>
				</label>
				<label className="flex items-center gap-1.5">
					<input
						type="checkbox"
						checked={store.showTags}
						onChange={(event) => store.setShowTags(event.target.checked)}
					/>
					<Trans>Tags</Trans>
				</label>
				<div className="ml-auto flex items-center gap-1">
					<div className="relative">
						<LuSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							ref={searchRef}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									jumpToMatch(event.shiftKey ? -1 : 1);
								} else if (event.key === "Escape" && search) {
									event.preventDefault();
									event.stopPropagation();
									setSearch("");
								}
							}}
							placeholder={t`Find: message, author, hash, branch`}
							title={t`Find (⌘F)`}
							className="h-7 w-56 pl-7 text-xs"
						/>
					</div>
					{needle && (
						<>
							<span className="w-14 text-center text-xs text-muted-foreground tabular-nums">
								{matches.length > 0
									? `${matchCursor + 1}/${matches.length}`
									: "0/0"}
							</span>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={t`Previous match`}
								onClick={() => jumpToMatch(-1)}
							>
								<LuChevronUp className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={t`Next match`}
								onClick={() => jumpToMatch(1)}
							>
								<LuChevronDown className="size-3.5" />
							</Button>
						</>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						title={
							log.data
								? t`Refresh (last load ${log.data.durationMs} ms)`
								: t`Refresh`
						}
						aria-label={t`Refresh`}
						disabled={log.isFetching}
						onClick={refresh}
					>
						<LuRefreshCw
							className={cn(
								"size-3.5",
								log.isFetching && "animate-spin motion-reduce:animate-none",
							)}
						/>
					</Button>
				</div>
			</div>

			<div className="flex h-7 shrink-0 items-center gap-2 border-b pr-3 text-xs font-semibold">
				<span
					className="shrink-0 self-stretch border-r pl-2 leading-7"
					style={{ width: graphWidth }}
				>
					<Trans>Graph</Trans>
				</span>
				<span className="min-w-0 flex-1">
					<Trans>Description</Trans>
				</span>
				<span className={cn("shrink-0", GIT_GRAPH_COLUMNS.date)}>
					<Trans>Date</Trans>
				</span>
				<span className={cn("shrink-0", GIT_GRAPH_COLUMNS.author)}>
					<Trans>Author</Trans>
				</span>
				<span className={cn("shrink-0", GIT_GRAPH_COLUMNS.hash)}>
					<Trans>Commit</Trans>
				</span>
			</div>

			{error && commits.length === 0 ? (
				<div className="flex cursor-text select-text flex-col items-start gap-3 p-4 text-sm text-destructive">
					<span>{error.message}</span>
					<Button variant="outline" size="sm" onClick={refresh}>
						<Trans>Try again</Trans>
					</Button>
				</div>
			) : commits.length === 0 ? (
				<div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
					{unavailable ? (
						<Trans>
							This repository is not on a connected host. Pick another one.
						</Trans>
					) : log.isFetching || overview.isFetching || !isReady ? (
						<>
							<LuRefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
							<Trans>Loading history…</Trans>
						</>
					) : (
						<>
							<LuGitGraph className="size-4" />
							<Trans>No commits for these filters.</Trans>
						</>
					)}
				</div>
			) : (
				<div
					ref={scrollRef}
					className="min-h-0 flex-1 overflow-y-auto outline-none"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: the list takes arrow keys
					tabIndex={0}
				>
					<div
						className="relative w-full"
						style={{ height: virtualizer.getTotalSize() }}
					>
						{virtualizer.getVirtualItems().map((item) => {
							const row = layout[item.index];
							if (!row) return null;
							if (showUncommitted && item.index === 0) {
								return (
									<div
										key={UNCOMMITTED}
										className="absolute top-0 left-0 flex w-full items-center gap-2 pr-3 text-xs"
										style={{
											height: GRAPH_ROW_HEIGHT,
											transform: `translateY(${item.start}px)`,
										}}
									>
										<div
											className="shrink-0 overflow-hidden pl-2"
											style={{ width: graphWidth }}
										>
											<GitGraphCell
												row={row}
												width={(row.width + 1) * GRAPH_LANE_WIDTH}
												node="uncommitted"
												isDimmed={false}
											/>
										</div>
										<span className="font-semibold">
											<Trans>Uncommitted Changes ({uncommitted})</Trans>
										</span>
										{headBranch && (
											<span className="text-muted-foreground">
												<Trans>on {headBranch}</Trans>
											</span>
										)}
									</div>
								);
							}
							const index = item.index - offset;
							const commit = commits[index];
							if (!commit) return null;
							const isSelected = index === selectedIndex;
							return (
								<div
									key={commit.hash}
									className="absolute top-0 left-0 w-full"
									style={{ transform: `translateY(${item.start}px)` }}
								>
									<GitGraphRow
										commit={commit}
										layout={row}
										node={commit.hash === headHash ? "head" : "commit"}
										graphWidth={graphWidth}
										badges={badges[index] ?? []}
										isDimmed={!!needle && !matchSet.has(index)}
										isSelected={isSelected}
										onSelect={() => toggleSelected(commit.hash)}
										onOpenWorkspace={openWorkspace}
										onOpenConversation={openConversation}
										onFilterRef={filterRef}
									/>
									{isSelected && hostUrl && projectId && (
										<GitGraphCommitDetails
											hostUrl={hostUrl}
											projectId={projectId}
											hash={commit.hash}
											row={row}
											graphWidth={graphWidth}
											repoUrl={repoUrl}
											onSelectHash={selectHash}
											onClose={() => setSelectedHash(null)}
										/>
									)}
								</div>
							);
						})}
					</div>
					{log.data?.hasMore && (
						<div className="flex justify-center p-3">
							{limit < MAX_COMMITS ? (
								<Button
									variant="outline"
									size="sm"
									disabled={log.isFetching}
									onClick={() =>
										setLimit((current) =>
											Math.min(current + PAGE_SIZE, MAX_COMMITS),
										)
									}
								>
									<Trans>Load {PAGE_SIZE} more commits</Trans>
								</Button>
							) : (
								<span className="text-xs text-muted-foreground">
									<Trans>
										Showing the latest {MAX_COMMITS} commits. Filter by branch
										to go further back.
									</Trans>
								</span>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

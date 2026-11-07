import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { cn } from "@superset/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	LuChevronDown,
	LuChevronUp,
	LuFolderGit2,
	LuGitGraph,
	LuRefreshCw,
	LuSearch,
} from "react-icons/lu";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useProjectQueryTargets } from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useGitGraphStore } from "../../stores/gitGraphStore";
import { type BranchPlace, buildRefBadges } from "../../utils/buildRefBadges";
import { indexBranchPlaces } from "../../utils/indexBranchPlaces";
import { layoutGitGraph } from "../../utils/layoutGitGraph";
import { GRAPH_LANE_WIDTH, GRAPH_ROW_HEIGHT } from "../GitGraphCell";
import { GitGraphRefFilter, type RefOption } from "../GitGraphRefFilter";
import {
	GIT_GRAPH_COLUMNS,
	type GitGraphBadge,
	GitGraphRow,
} from "../GitGraphRow";

const PAGE_SIZE = 1_000;
const MAX_COMMITS = 5_000;
// Past this many lanes the graph column scrolls its content out of view
// rather than squeezing the descriptions.
const MAX_VISIBLE_LANES = 20;

const NO_PLACE: BranchPlace<never, never> = {
	worktreePath: null,
	workspace: null,
	conversation: null,
};

export function GitGraphView() {
	const { t } = useLingui();
	const navigate = useNavigate();
	const { targets, isReady } = useProjectQueryTargets([]);
	const store = useGitGraphStore();
	const target =
		targets.find((item) => item.projectId === store.projectId) ??
		targets[0] ??
		null;
	const projectId = target?.projectId ?? null;
	const hostUrl = target?.hostUrl ?? null;
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
	const layout = useMemo(() => layoutGitGraph(commits), [commits]);
	const maxLanes = layout.reduce((max, row) => Math.max(max, row.width), 1);
	const graphWidth =
		Math.min(maxLanes, MAX_VISIBLE_LANES) * GRAPH_LANE_WIDTH + 16;

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

	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: commits.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => GRAPH_ROW_HEIGHT,
		overscan: 20,
	});

	const jumpToMatch = (offset: number) => {
		if (matches.length === 0) return;
		const next = (matchCursor + offset + matches.length) % matches.length;
		setMatchCursor(next);
		const index = matches[next] as number;
		setSelectedHash(commits[index]?.hash ?? null);
		virtualizer.scrollToIndex(index, { align: "center" });
	};
	useEffect(() => {
		setMatchCursor(0);
		const first = matches[0];
		if (first !== undefined) {
			virtualizer.scrollToIndex(first, { align: "center" });
		}
	}, [matches, virtualizer]);

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

	const refresh = () => {
		void overview.refetch();
		void log.refetch();
	};

	if (isReady && targets.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
				<Trans>Add a project to see its git graph.</Trans>
			</div>
		);
	}

	const headBranch = overview.data?.headBranch ?? null;
	const uncommitted = overview.data?.uncommittedCount ?? 0;
	const error = log.error ?? overview.error;

	return (
		<div className="@container flex h-full min-w-0 flex-col overflow-hidden">
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
				<Select
					value={projectId ?? undefined}
					onValueChange={(value) => store.setProjectId(value)}
				>
					<SelectTrigger size="sm" className="h-7 w-48 text-xs">
						<SelectValue placeholder={t`Repository`} />
					</SelectTrigger>
					<SelectContent>
						{targets.map((item) => (
							<SelectItem
								key={item.projectId}
								value={item.projectId}
								className="text-xs"
							>
								{item.projectName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
				<label className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={store.showRemotes}
						onChange={(event) => store.setShowRemotes(event.target.checked)}
					/>
					<Trans>Remote branches</Trans>
				</label>
				<label className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									jumpToMatch(event.shiftKey ? -1 : 1);
								}
							}}
							placeholder={t`Message, author, hash, branch`}
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

			<div className="flex h-7 shrink-0 items-center gap-2 border-b bg-muted/30 pr-3 text-[10px] text-muted-foreground uppercase tracking-wide">
				<span className="shrink-0 pl-3" style={{ width: graphWidth }}>
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
					{log.isFetching || !isReady ? (
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
				<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
					{uncommitted > 0 && (
						<div
							className="flex items-center gap-2 border-b border-dashed px-3 text-xs"
							style={{ height: GRAPH_ROW_HEIGHT }}
						>
							<span className="shrink-0" style={{ width: graphWidth - 12 }} />
							<span className="font-medium">
								<Trans>Uncommitted changes ({uncommitted})</Trans>
							</span>
							{headBranch && (
								<span className="text-muted-foreground">
									<Trans>on {headBranch}</Trans>
								</span>
							)}
						</div>
					)}
					<div
						className="relative w-full"
						style={{ height: virtualizer.getTotalSize() }}
					>
						{virtualizer.getVirtualItems().map((item) => {
							const commit = commits[item.index];
							const row = layout[item.index];
							if (!commit || !row) return null;
							return (
								<div
									key={commit.hash}
									className="absolute top-0 left-0 w-full"
									style={{ transform: `translateY(${item.start}px)` }}
								>
									<GitGraphRow
										commit={commit}
										layout={row}
										graphWidth={graphWidth}
										badges={badges[item.index] ?? []}
										isDimmed={!!needle && !matchSet.has(item.index)}
										isSelected={selectedHash === commit.hash}
										onSelect={() =>
											setSelectedHash((current) =>
												current === commit.hash ? null : commit.hash,
											)
										}
										onOpenWorkspace={openWorkspace}
										onOpenConversation={openConversation}
										onFilterRef={filterRef}
									/>
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

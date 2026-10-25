import { Trans, useLingui } from "@lingui/react/macro";
import { FEATURE_FLAGS } from "@superset/shared/constants";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { toast } from "@superset/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { type ReactNode, useRef } from "react";
import { GoGitPullRequest } from "react-icons/go";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import {
	LuClock,
	LuCloud,
	LuFileText,
	LuGauge,
	LuLayers,
	LuPlus,
	LuPuzzle,
	LuSearch,
	LuStickyNote,
} from "react-icons/lu";
import {
	VscFolderOpened,
	VscGithubAlt,
	VscLayout,
	VscNewFolder,
} from "react-icons/vsc";
import { useFrameStackStore } from "renderer/commandPalette";
import { GATED_FEATURES, usePaywall } from "renderer/components/Paywall";
import { SidebarKbdHint } from "renderer/components/SidebarKbdHint";
import { ZoomStable } from "renderer/components/ZoomStable";
import { env } from "renderer/env.renderer";
import {
	useOpenNewWorkspace,
	useOpenNewWorkspaceForLocalProject,
} from "renderer/hooks/useOpenNewWorkspace";
import { useZoomFactor } from "renderer/hooks/useZoomFactor";
import { useHotkeyDisplay } from "renderer/hotkeys";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useFolderFirstImport } from "renderer/routes/_authenticated/_dashboard/components/AddRepositoryModals/hooks/useFolderFirstImport";
import { AppMenuButton } from "renderer/routes/_authenticated/_dashboard/components/AppMenuButton";
import { NavigationControls } from "renderer/routes/_authenticated/_dashboard/components/NavigationControls";
import { OfflineBadge } from "renderer/routes/_authenticated/_dashboard/components/OfflineBadge";
import { PortsDropdown } from "renderer/routes/_authenticated/_dashboard/components/PortsDropdown";
import { SidebarToggle } from "renderer/routes/_authenticated/_dashboard/components/SidebarToggle";
import { ProjectGlyph } from "renderer/routes/_authenticated/_dashboard/components/TaskProjectIcon";
import {
	WINDOW_CHROME_BAND_CLASS,
	WINDOW_CONTROLS_ROW_HEIGHT,
	WINDOW_CONTROLS_ROW_TOP,
} from "renderer/routes/_authenticated/_dashboard/components/WindowChrome";
import { useFailedAutomations } from "renderer/routes/_authenticated/_dashboard/hooks/useFailedAutomations";
import { useShowsAppTopBar } from "renderer/routes/_authenticated/_dashboard/hooks/useShowsAppTopBar";
import {
	pullRequestsSearchFromFilters,
	usePullRequestsFilterStore,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsFilterStore";
import {
	tasksSearchFromFilters,
	useTasksFilterStore,
} from "renderer/routes/_authenticated/_dashboard/tasks/stores/tasks-filter-state";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	getUsageLastSection,
	usageSectionPath,
} from "renderer/routes/_authenticated/settings/usage/utils/usageLastSection";
import { STROKE_WIDTH_THICK } from "renderer/screens/main/components/WorkspaceSidebar/constants";
import {
	useOpenEmptyProjectModal,
	useOpenNewProjectModal,
	useOpenTemplateGalleryModal,
} from "renderer/stores/add-repository-modal";
import {
	NAV_ITEM_HOTKEY,
	type SidebarNavItemId,
	useSidebarPreference,
} from "renderer/stores/sidebar-preferences";
import { COLLAPSED_WORKSPACE_SIDEBAR_WIDTH } from "renderer/stores/workspace-sidebar-state";
import { SidebarNavButton } from "./components/SidebarNavButton";
import { SidebarNavHotkey } from "./components/SidebarNavHotkey";
import { SidebarNavRailButton } from "./components/SidebarNavRailButton";

const NAV_ICON_CLASS = "size-4 shrink-0 text-muted-foreground";

interface DashboardSidebarHeaderProps {
	isCollapsed?: boolean;
}

export function DashboardSidebarHeader({
	isCollapsed = false,
}: DashboardSidebarHeaderProps) {
	const { t } = useLingui();
	const openNewWorkspace = useOpenNewWorkspace();
	const openProjectWorkspace = useOpenNewWorkspaceForLocalProject();
	const openEmptyProject = useOpenEmptyProjectModal();
	const openNewProject = useOpenNewProjectModal();
	const openTemplateGallery = useOpenTemplateGalleryModal();
	const navigate = useNavigate();
	const folderImport = useFolderFirstImport({
		onError: (message) => {
			toast.error(
				t({
					message: `Import failed: ${message}`,
				}),
			);
		},
		onMultipleProjects: ({ candidates }) => {
			toast.error(
				t({
					message: "Import failed",
				}),
				{
					description: t({
						message: `Multiple projects use this repository (${candidates.length}). Choose the project in settings to set it up on this device.`,
					}),
					action: {
						label: t({
							message: "Open Projects",
						}),
						onClick: () => navigate({ to: "/settings/projects" }),
					},
				},
			);
		},
	});

	const handleImportFolder = async () => {
		const result = await folderImport.start();
		if (result) {
			openProjectWorkspace(result.projectId);
			toast.success(
				t({
					message: "Project imported and selected.",
				}),
			);
		}
	};

	const shortcutText = useHotkeyDisplay("NEW_WORKSPACE").text;
	const searchShortcutText = useHotkeyDisplay("OPEN_COMMAND_PALETTE").text;
	const openCommandPalette = useFrameStackStore((s) => s.setOpen);
	// The palette dialog dismisses on outside pointerdown before our click fires,
	// so a live-state toggle would always reopen it. Capture the state at
	// pointerdown to make clicking the button close an open palette.
	const paletteWasOpenRef = useRef(false);
	const handleSearchPointerDown = () => {
		paletteWasOpenRef.current = useFrameStackStore.getState().open;
	};
	const handleSearchClick = () => {
		openCommandPalette(!paletteWasOpenRef.current);
		paletteWasOpenRef.current = false;
	};
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	// Default to Mac while loading so we don't briefly cover the traffic lights.
	const isMac = platform === undefined || platform === "darwin";
	const zoomFactor = useZoomFactor();
	const matchRoute = useMatchRoute();
	const { gateFeature, hasAccess } = usePaywall();
	const isWorkspacesListOpen = !!matchRoute({ to: "/v2-workspaces" });
	const isCloudWorkspacesOpen = !!matchRoute({
		to: "/cloud-workspaces",
		fuzzy: true,
	});
	const isProjectsOpen = !!matchRoute({ to: "/projects", fuzzy: true });
	const isCloudEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
	const v2WorkspaceMatch = matchRoute({
		to: "/v2-workspace/$workspaceId",
		fuzzy: true,
	});
	const showsAppTopBar = useShowsAppTopBar();
	// Pre-select the viewed workspace's project in the new-workspace modal.
	const { workspaces: hostWorkspaces } = useHostWorkspaces();
	const activeProjectId =
		v2WorkspaceMatch !== false
			? (hostWorkspaces.find(
					(workspace) => workspace.id === v2WorkspaceMatch.workspaceId,
				)?.projectId ?? undefined)
			: undefined;
	const isTasksOpen = !!matchRoute({ to: "/tasks", fuzzy: true });
	const isPullRequestsOpen = !!matchRoute({
		to: "/pull-requests",
		fuzzy: true,
	});
	const isAutomationsOpen = !!matchRoute({ to: "/automations", fuzzy: true });
	const isPluginsOpen = !!matchRoute({ to: "/plugins", fuzzy: true });
	const isPagesOpen = !!matchRoute({ to: "/pages", fuzzy: true });
	const isNotesOpen = !!matchRoute({ to: "/notes", fuzzy: true });
	// `?? false`: the hook returns undefined until PostHog flags resolve.
	// Dev builds bypass the flag — the local dev account isn't in the
	// @superset.sh release condition.
	const isPluginsEnabled =
		(useFeatureFlagEnabled(FEATURE_FLAGS.PLUGINS) ?? false) ||
		env.NODE_ENV === "development";
	const cloudUtils = cloudTrpc.useUtils();
	const { myFailedCount } = useFailedAutomations();

	const {
		tab: lastTab,
		assignee: lastAssignee,
		label: lastLabel,
		search: lastSearch,
		typeTab: lastTypeTab,
		projectFilters: lastProjectFilters,
		includeClosedIssues: lastIncludeClosedIssues,
	} = useTasksFilterStore();
	const {
		search: lastPullRequestsSearch,
		projectFilters: lastPullRequestsProjectFilters,
		authorFilter: lastPullRequestsAuthorFilter,
		reviewFilter: lastPullRequestsReviewFilter,
		includeClosed: lastPullRequestsIncludeClosed,
		mergedOnly: lastPullRequestsMergedOnly,
	} = usePullRequestsFilterStore();

	const handleWorkspacesClick = () => {
		navigate({ to: "/v2-workspaces" });
	};

	const handleCloudWorkspacesClick = () => {
		navigate({ to: "/cloud-workspaces" });
	};

	const handleProjectsClick = () => {
		navigate({ to: "/projects" });
	};

	// Automations are Pro, but an org that already has some (a downgrade) can
	// still reach the list to pause, edit, or delete them; the page gates the
	// actions that need the plan. A Free org with none meets the paywall here.
	// If the list can't be read the answer is unknown, so let the click
	// through: an empty list page gates every action itself, and a wrong
	// paywall on a downgraded org would be the worse mistake.
	const handleAutomationsClick = async () => {
		if (hasAccess(GATED_FEATURES.AUTOMATIONS)) {
			navigate({ to: "/automations" });
			return;
		}
		const automations = await cloudUtils.automation.list
			.fetch()
			.catch(() => null);
		if (automations === null || automations.length > 0) {
			navigate({ to: "/automations" });
			return;
		}
		gateFeature(GATED_FEATURES.AUTOMATIONS, () => {
			navigate({ to: "/automations" });
		});
	};

	const handleFailedAutomationsClick = () => {
		navigate({
			to: "/automations/runs",
			search: { status: "failed", scope: "mine" },
		});
	};

	const handleTasksClick = () => {
		gateFeature(GATED_FEATURES.TASKS, () => {
			navigate({
				to: "/tasks",
				search: tasksSearchFromFilters({
					tab: lastTab,
					assignee: lastAssignee,
					label: lastLabel,
					search: lastSearch,
					typeTab: lastTypeTab,
					projectFilters: lastProjectFilters,
					includeClosedIssues: lastIncludeClosedIssues,
				}),
			});
		});
	};

	const { data: isUsageInSidebarEnabled } =
		electronTrpc.settings.getShowUsageInSidebar.useQuery();

	const handlePagesClick = () => {
		navigate({ to: "/pages" });
	};

	const handleNotesClick = () => {
		navigate({ to: "/notes" });
	};

	const handlePluginsClick = () => {
		navigate({ to: "/plugins" });
	};

	const handlePullRequestsClick = () => {
		navigate({
			to: "/pull-requests",
			search: pullRequestsSearchFromFilters({
				search: lastPullRequestsSearch,
				projectFilters: lastPullRequestsProjectFilters,
				authorFilter: lastPullRequestsAuthorFilter,
				reviewFilter: lastPullRequestsReviewFilter,
				includeClosed: lastPullRequestsIncludeClosed,
				mergedOnly: lastPullRequestsMergedOnly,
			}),
		});
	};

	const handleUsageClick = () => {
		// Reopen whichever Usage section (token / machine resources) was
		// visited last.
		navigate({ to: usageSectionPath(getUsageLastSection()) });
	};

	const hiddenNavItems = useSidebarPreference("hiddenNavItems");
	const isNavItemShown = (id: SidebarNavItemId) => !hiddenNavItems.includes(id);
	const navItems: {
		id: Exclude<SidebarNavItemId, "search">;
		label: string;
		available: boolean;
		isActive: boolean;
		onClick: () => void;
		icon: ReactNode;
		railIcon: ReactNode;
	}[] = [
		{
			id: "workspaces",
			label: t({ message: "Workspaces" }),
			available: true,
			isActive: isWorkspacesListOpen,
			onClick: handleWorkspacesClick,
			icon: <LuLayers className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuLayers className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "cloudWorkspaces",
			label: t({ message: "Cloud workspaces" }),
			available: isCloudEnabled,
			isActive: isCloudWorkspacesOpen,
			onClick: handleCloudWorkspacesClick,
			icon: <LuCloud className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuCloud className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "projects",
			label: t({ message: "Projects" }),
			available: isCloudEnabled,
			isActive: isProjectsOpen,
			onClick: handleProjectsClick,
			icon: <ProjectGlyph className={NAV_ICON_CLASS} />,
			railIcon: <ProjectGlyph className="size-3.5" />,
		},
		{
			id: "automations",
			label: t({ message: "Automations" }),
			available: true,
			isActive: isAutomationsOpen,
			onClick: () => void handleAutomationsClick(),
			icon: <LuClock className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuClock className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "tasks",
			label: t({ message: "Tasks" }),
			available: true,
			isActive: isTasksOpen,
			onClick: handleTasksClick,
			icon: <HiOutlineClipboardDocumentList className={NAV_ICON_CLASS} />,
			railIcon: <HiOutlineClipboardDocumentList className="size-3.5" />,
		},
		{
			id: "pullRequests",
			label: t({ message: "Pull requests" }),
			available: true,
			isActive: isPullRequestsOpen,
			onClick: handlePullRequestsClick,
			icon: <GoGitPullRequest className={NAV_ICON_CLASS} />,
			railIcon: <GoGitPullRequest className="size-3.5" />,
		},
		{
			id: "usage",
			label: t({ message: "Usage" }),
			available: isUsageInSidebarEnabled === true,
			isActive: false,
			onClick: handleUsageClick,
			icon: <LuGauge className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuGauge className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "pages",
			label: t({ message: "Pages" }),
			available: true,
			isActive: isPagesOpen,
			onClick: handlePagesClick,
			icon: <LuFileText className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuFileText className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "notes",
			label: t({ message: "Notes" }),
			available: true,
			isActive: isNotesOpen,
			onClick: handleNotesClick,
			icon: <LuStickyNote className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuStickyNote className="size-3.5" strokeWidth={1.5} />,
		},
		{
			id: "plugins",
			label: t({ message: "Plugins" }),
			available: isPluginsEnabled,
			isActive: isPluginsOpen,
			onClick: handlePluginsClick,
			icon: <LuPuzzle className={NAV_ICON_CLASS} strokeWidth={1.5} />,
			railIcon: <LuPuzzle className="size-3.5" strokeWidth={1.5} />,
		},
	];
	const shownNavItems = navItems.filter(
		(item) => item.available && isNavItemShown(item.id),
	);
	// Shortcuts work for hidden entries too.
	const navHotkeys = navItems.map((item) => (
		<SidebarNavHotkey
			key={item.id}
			hotkeyId={NAV_ITEM_HOTKEY[item.id]}
			onTrigger={item.onClick}
			enabled={item.available}
		/>
	));
	const automationsFailedBadge =
		myFailedCount > 0 ? (
			<button
				type="button"
				onClick={handleFailedAutomationsClick}
				title={t({
					message: `${myFailedCount} of your automations failed their last run`,
				})}
				className="absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-medium tabular-nums text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-400"
			>
				{myFailedCount > 9 ? "9+" : myFailedCount}
			</button>
		) : undefined;

	if (isCollapsed) {
		return (
			<div className="flex flex-col">
				{/* The page's header row continues across the rail, and the macOS
				    window buttons sit in it. */}
				{!showsAppTopBar && (
					<div
						// w +1px: overlaps the container's border-r so the sidebar's
						// vertical border starts below the row, not inside it.
						className={cn(
							"drag h-12 w-[calc(100%+1px)] shrink-0",
							WINDOW_CHROME_BAND_CLASS,
						)}
					>
						{!isMac && (
							<div
								className="flex items-center justify-center"
								style={{
									width: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
									marginTop: WINDOW_CONTROLS_ROW_TOP,
									height: WINDOW_CONTROLS_ROW_HEIGHT,
								}}
							>
								<AppMenuButton />
							</div>
						)}
					</div>
				)}
				{/* Mirrors the expanded header's nav container so the buttons keep
				    the same padding, order, and vertical rhythm when collapsed. */}
				<div className="flex flex-col items-center gap-1 px-2 pt-3 pb-2">
					<Tooltip delayDuration={300}>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => openNewWorkspace(activeProjectId)}
								className="flex size-7 items-center justify-center rounded-md bg-fill-hover/60 [.light_&]:bg-fill-hover text-muted-foreground transition-colors hover:bg-fill-selected [.light_&]:hover:bg-fill-selected"
							>
								<div className="flex size-5 items-center justify-center rounded bg-fill-selected">
									<LuPlus className="size-3" strokeWidth={STROKE_WIDTH_THICK} />
								</div>
							</button>
						</TooltipTrigger>
						<TooltipContent side="right">
							<Trans>New Workspace ({shortcutText})</Trans>
						</TooltipContent>
					</Tooltip>

					{isNavItemShown("search") && (
						<Tooltip delayDuration={300}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onPointerDown={handleSearchPointerDown}
									onClick={handleSearchClick}
									className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover"
								>
									<LuSearch className="size-3.5" strokeWidth={1.5} />
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">
								{searchShortcutText !== "Unassigned"
									? t({
											message: `Search (${searchShortcutText})`,
										})
									: t({
											message: "Search",
										})}
							</TooltipContent>
						</Tooltip>
					)}

					{shownNavItems.map((item) => (
						<SidebarNavRailButton
							key={item.id}
							label={item.label}
							tooltip={
								item.id === "automations" && myFailedCount > 0
									? t({
											message: `Automations (${myFailedCount} failing)`,
										})
									: undefined
							}
							icon={item.railIcon}
							hotkeyId={NAV_ITEM_HOTKEY[item.id]}
							isActive={item.isActive}
							onClick={item.onClick}
							showAlertDot={item.id === "automations" && myFailedCount > 0}
						/>
					))}
					{navHotkeys}

					<DropdownMenu>
						<Tooltip delayDuration={700}>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										aria-label={t({
											message: "Add project",
										})}
										className="group/addrepo flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover"
									>
										<VscNewFolder className="size-3.5 group-hover/addrepo:hidden" />
										<VscFolderOpened className="hidden size-3.5 group-hover/addrepo:block" />
									</button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent side="right">
								<Trans>Add project</Trans>
							</TooltipContent>
						</Tooltip>
						<DropdownMenuContent
							align="start"
							onCloseAutoFocus={(event) => event.preventDefault()}
						>
							<DropdownMenuItem onSelect={handleImportFolder}>
								<VscFolderOpened className="size-4" />
								<Trans>Open project</Trans>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => openNewProject()}>
								<VscGithubAlt className="size-4" />
								<Trans>Clone from URL</Trans>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => openEmptyProject()}>
								<VscNewFolder className="size-4" />
								<Trans>Create new project</Trans>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => openTemplateGallery()}>
								<VscLayout className="size-4" />
								<Trans>Start from a template</Trans>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col gap-px px-2 pt-2 pb-2"
			// Pin the top inset so the traffic-light row stays a constant physical
			// distance from the window top under page zoom (see the row below).
			style={{
				paddingTop: `${WINDOW_CONTROLS_ROW_TOP / (isMac ? zoomFactor : 1)}px`,
			}}
		>
			{/* -mx-2 cancels the parent's px-2 so this row owns the 80px traffic-light
			    inset; inset and height are counter-scaled to a constant physical size
			    so the fixed macOS traffic lights stay aligned under page zoom. On Mac
			    the control clusters below use ZoomStable so the collapse/nav icons and
			    usage badge keep a constant physical size instead of scaling with page
			    zoom and overflowing this fixed-height row. It's Mac-only because the
			    pinned row height it matches is Mac-only; elsewhere the row height (h-8)
			    scales with zoom, so the controls should scale with it. */}
			<div
				// Window-drag regions live on the empty spacer + filler leaves, never
				// on this row: `no-drag` carve-outs under a `drag` ancestor are lost
				// inside zoomed wrappers like ZoomStable, deadening the controls.
				className="-mx-2 mb-3 flex h-8 items-center pr-3"
				style={
					isMac
						? { height: `${WINDOW_CONTROLS_ROW_HEIGHT / zoomFactor}px` }
						: undefined
				}
			>
				{isMac ? (
					<div
						className="drag h-full shrink-0"
						style={{ width: `${80 / zoomFactor}px` }}
					/>
				) : (
					<div
						className="flex h-full shrink-0 items-center justify-center"
						style={{ width: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH }}
					>
						<AppMenuButton />
					</div>
				)}
				<ZoomStable enabled={isMac} className="flex items-center gap-1">
					<SidebarToggle />
					<NavigationControls />
					{/* Lives here (persistent chrome) rather than the workspace tab
					    bar, which remounts on every navigation. */}
					<PortsDropdown align="start" />
					<OfflineBadge />
				</ZoomStable>
				<div className="drag h-full min-w-0 flex-1" />
			</div>

			<button
				type="button"
				onClick={() => openNewWorkspace(activeProjectId)}
				className="group flex h-7 w-full items-center gap-2 rounded-md bg-fill-hover/60 [.light_&]:bg-fill-hover px-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-selected [.light_&]:hover:bg-fill-selected hover:text-foreground"
			>
				<div className="flex size-5 shrink-0 items-center justify-center rounded bg-fill-selected">
					<LuPlus className="size-3" strokeWidth={STROKE_WIDTH_THICK} />
				</div>
				<span className="flex-1 truncate text-left whitespace-nowrap">
					<Trans>New Workspace</Trans>
				</span>
				<SidebarKbdHint label={shortcutText} />
			</button>

			{isNavItemShown("search") && (
				<button
					type="button"
					onPointerDown={handleSearchPointerDown}
					onClick={handleSearchClick}
					className="group flex h-[var(--sb-row-h)] w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground"
				>
					<LuSearch
						className="size-4 shrink-0 text-muted-foreground"
						strokeWidth={1.5}
					/>
					<span className="flex-1 text-left">
						<Trans>Search</Trans>
					</span>
					{searchShortcutText !== "Unassigned" && (
						<SidebarKbdHint label={searchShortcutText} />
					)}
				</button>
			)}

			{shownNavItems.map((item) => (
				<SidebarNavButton
					key={item.id}
					label={item.label}
					icon={item.icon}
					hotkeyId={NAV_ITEM_HOTKEY[item.id]}
					isActive={item.isActive}
					onClick={item.onClick}
					badge={item.id === "automations" ? automationsFailedBadge : undefined}
				/>
			))}
			{navHotkeys}
		</div>
	);
}

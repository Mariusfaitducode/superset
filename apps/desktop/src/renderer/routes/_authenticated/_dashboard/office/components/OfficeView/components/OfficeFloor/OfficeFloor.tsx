import { Trans, useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useNavigate } from "@tanstack/react-router";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { LuBuilding2 } from "react-icons/lu";
import { useWorkStateLabels } from "renderer/components/WorkState";
import type { HostWorkspaceItem } from "renderer/hooks/host-workspaces/useHostWorkspaces";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import {
	deriveWorkState,
	WORK_STATES,
	type WorkStateInfo,
} from "renderer/lib/agent-state";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import type {
	SidebarConversation,
	SidebarSubagent,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import {
	useLabelsByHost,
	type WorkspaceLabel,
	workspaceLabels,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels";
import { useSidebarWorkspaceStatuses } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { useCachedMyPullRequests } from "renderer/routes/_authenticated/_dashboard/hooks/useCachedMyPullRequests";
import { useOfficeCamera } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeCamera";
import { useOfficeGroups } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeGroups";
import { useOfficeToneLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeToneLabels";
import { usePrefersReducedMotion } from "renderer/routes/_authenticated/_dashboard/office/hooks/usePrefersReducedMotion";
import {
	PROJECT_STATUS_COLOR,
	useProjectStatusLabels,
} from "renderer/routes/_authenticated/_dashboard/office/hooks/useProjectStatusLabels";
import { useOfficeFilterStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-filter";
import { useOfficeProjectsStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-projects";
import { seedFor } from "renderer/routes/_authenticated/_dashboard/office/utils/characterFrame";
import type {
	OfficeScene,
	OfficeSceneAgent,
	OfficeSceneHelper,
	OfficeSceneWorkflow,
} from "renderer/routes/_authenticated/_dashboard/office/utils/drawOffice";
import {
	type FilterableAgent,
	facetCounts,
	isFiltering,
	matchesOfficeFilter,
	NO_STATUS,
	type OfficeFilter,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeFilters";
import {
	HEADER_HEIGHT,
	HELPER_SCALE,
	layoutOffice,
	type OfficeDesk,
	type OfficeRoom,
	type OfficeWorkflow,
	PLATE_HEIGHT,
	type Point,
	pathToCoffee,
	TILE_SIZE,
	WORKFLOW_SCALE,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeLayout";
import {
	assignWorkspaceProject,
	indexPullRequestsByBranch,
	type ProjectVia,
	projectNotionSpecs,
	workspacePullRequests,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeProjects";
import {
	type ArrowKey,
	countTones,
	deskTone,
	type IslandCounts,
	moveFocus,
	type OfficeTone,
	orderIslands,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";
import { useMyPullRequestsStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import {
	assignPullRequestProject,
	OTHER_PROJECT_ID,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import {
	buildSubagentSearch,
	navigateToV2Workspace,
} from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { useWorkspaceFocus } from "renderer/stores/workspace-focus";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";
import { OfficeAgentPanel } from "./components/OfficeAgentPanel";
import { OfficeCameraControls } from "./components/OfficeCameraControls";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OfficeDeskPlate } from "./components/OfficeDeskPlate";
import { OfficeFilterBar } from "./components/OfficeFilterBar";
import { OfficeHelperButton } from "./components/OfficeHelperButton";
import { OfficeProjectPanel } from "./components/OfficeProjectPanel";
import { OfficeRoomHeader } from "./components/OfficeRoomHeader";
import { OfficeSeatButton } from "./components/OfficeSeatButton";
import { OfficeWorkflowLabel } from "./components/OfficeWorkflowLabel";
import {
	type OfficeWorkspaceReport,
	OfficeWorkspaceSource,
} from "./components/OfficeWorkspaceSource";

/** CSS pixels per art pixel at 100% zoom. */
const BASE_SCALE = 2;

const ARROW_KEYS = new Set<string>([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
]);

interface Selection {
	workspaceId: string;
	terminalId: string;
}

/** One chat: an employee at its workspace's desk. */
interface Member {
	workspace: HostWorkspaceItem;
	conversation: SidebarConversation;
	tone: OfficeTone;
	work: WorkStateInfo;
	topTodo: string | null;
	openTodos: number;
	/** Its own subagents; workflow agents sit at their run's table. */
	helpers: SidebarSubagent[];
}

/** One workflow run in a workspace, and the conversation that started it. */
interface WorkflowUnit {
	runId: string;
	name: string | null;
	phase: string | null;
	parent: Member;
	agents: SidebarSubagent[];
}

/** One workspace: a cubicle in its group's room. */
interface DeskUnit {
	key: string;
	name: string;
	workspace: HostWorkspaceItem;
	members: Member[];
	workflows: WorkflowUnit[];
	tones: OfficeTone[];
	labels: WorkspaceLabel[];
	project: DeskProject;
}

interface DeskProject {
	id: string;
	name: string;
	via: ProjectVia | null;
}

/** One group (sidebar folder, or project): a room. */
interface RoomUnit {
	key: string;
	name: string;
	color: string | null;
	/** Set when rooms stand for projects. */
	projectId?: string;
	desks: DeskUnit[];
	tones: OfficeTone[];
}

export function OfficeFloor({
	workspaces,
}: {
	workspaces: HostWorkspaceItem[];
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const reducedMotion = usePrefersReducedMotion();
	const toneLabels = useOfficeToneLabels();
	const workWords = useWorkStateLabels();
	const statusLabels = useProjectStatusLabels();
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const statuses = useSidebarWorkspaceStatuses();
	const filterStates = useOfficeFilterStore((state) => state.states);
	const filterProjects = useOfficeFilterStore((state) => state.projects);
	const filterProjectStatuses = useOfficeFilterStore(
		(state) => state.projectStatuses,
	);
	const roomsBy = useOfficeFilterStore((state) => state.rooms);
	const clearFilters = useOfficeFilterStore((state) => state.clear);
	const { focused, filterOn: focusFilterOn } = useWorkspaceFocus();
	const filter = useMemo<OfficeFilter>(
		() => ({
			states: filterStates,
			projects: filterProjects,
			projectStatuses: filterProjectStatuses,
			focusOnly: focusFilterOn,
		}),
		[filterStates, filterProjects, filterProjectStatuses, focusFilterOn],
	);
	const projects = useMyPullRequestsStore((state) => state.projects);
	const pullRequestMoves = useMyPullRequestsStore(
		(state) => state.projectMoves,
	);
	const manualProjects = useOfficeProjectsStore(
		(state) => state.workspaceProjects,
	);
	const pullRequests = useCachedMyPullRequests();
	const pullRequestIndex = useMemo(
		() => indexPullRequestsByBranch(pullRequests),
		[pullRequests],
	);
	const pullRequestsByProject = useMemo(() => {
		const map = new Map<string, MyPullRequestItem[]>();
		for (const pr of pullRequests) {
			const id = assignPullRequestProject(pr, projects, pullRequestMoves);
			const list = map.get(id) ?? [];
			list.push(pr);
			map.set(id, list);
		}
		return map;
	}, [pullRequests, projects, pullRequestMoves]);
	const noProjectName = t`No project`;

	// Every workspace gets a desk; only the ones with agents are read.
	const staffed = useMemo(
		() =>
			workspaces.filter(
				(workspace) => (statuses.get(workspace.id)?.bindings.size ?? 0) > 0,
			),
		[workspaces, statuses],
	);
	const groups = useOfficeGroups(workspaces);

	const [reports, setReports] = useState<
		ReadonlyMap<string, OfficeWorkspaceReport>
	>(new Map());
	const onReport = useCallback(
		(workspaceId: string, report: OfficeWorkspaceReport | null) => {
			setReports((previous) => {
				if (previous.get(workspaceId) === report) return previous;
				const next = new Map(previous);
				if (report) next.set(workspaceId, report);
				else next.delete(workspaceId);
				return next;
			});
		},
		[],
	);

	const hostIds = useMemo(
		() => workspaces.map((workspace) => workspace.hostId),
		[workspaces],
	);
	const labelsByHost = useLabelsByHost(hostIds, true);

	const organizationId = useActiveOrganizationId();
	const { data: integrations } = cloudTrpc.integration.list.useQuery(
		{ organizationId: organizationId ?? "" },
		{ enabled: !!organizationId },
	);
	const providers = useMemo(
		() => [...new Set((integrations ?? []).map((row) => row.provider))],
		[integrations],
	);

	const [selection, setSelectionState] = useState<Selection | null>(null);
	const [projectPanel, setProjectPanel] = useState<string | null>(null);
	const setSelection = useCallback((next: Selection | null) => {
		setSelectionState(next);
		if (next) setProjectPanel(null);
	}, []);
	const openProjectPanel = useCallback((projectId: string) => {
		setProjectPanel(projectId);
		setSelectionState(null);
	}, []);

	const { allRooms, shownRooms, agents, everyone, projectOf } = useMemo(() => {
		const projectsById = new Map(
			projects.map((project) => [project.id, project]),
		);
		const byKey = new Map<string, RoomUnit>();
		const agents: FilterableAgent[] = [];
		// Every open agent, filtered or not, for the project panel.
		const everyone: {
			workspace: HostWorkspaceItem;
			conversation: SidebarConversation;
			work: WorkStateInfo;
			projectId: string;
		}[] = [];
		const projectOf = new Map<string, DeskProject>();
		for (const workspace of staffed) {
			const labels = workspaceLabels(
				labelsByHost.get(workspace.hostId),
				workspace.id,
			);
			const assigned = assignWorkspaceProject({
				workspace: {
					id: workspace.id,
					name: getV2WorkspaceDisplayName(workspace),
					branch: workspace.branch,
					projectId: workspace.projectId,
					labels: labels.map((label) => label.name),
				},
				pullRequests: workspacePullRequests(workspace, pullRequestIndex),
				projects,
				pullRequestMoves,
				manual: manualProjects,
			});
			const project = projectsById.get(assigned.projectId) ?? null;
			const projectStatus = project?.status ?? NO_STATUS;
			const group =
				roomsBy === "projects"
					? {
							key: `project:${assigned.projectId}`,
							name: project?.name ?? noProjectName,
							color: project?.status
								? PROJECT_STATUS_COLOR[project.status]
								: null,
							projectId: assigned.projectId,
						}
					: (groups.get(workspace.id) ?? {
							key: `workspace:${workspace.id}`,
							name: workspace.name,
							color: null,
						});
			const desk: DeskUnit = {
				key: workspace.id,
				name: getV2WorkspaceDisplayName(workspace),
				workspace,
				members: [],
				workflows: [],
				tones: [],
				labels,
				project: {
					id: assigned.projectId,
					name: project?.name ?? noProjectName,
					via: assigned.via,
				},
			};
			projectOf.set(workspace.id, desk.project);
			const report = reports.get(workspace.id);
			for (const conversation of report?.conversations ?? []) {
				const open = (
					report?.todosByTerminal?.get(conversation.terminalId) ?? []
				)
					.filter((todo) => showAgentTodos || todo.author !== "agent")
					.filter((todo) => !todo.done);
				const work =
					report?.workStates.byTerminal.get(conversation.terminalId) ??
					deriveWorkState({
						conversation: conversation.state,
						since: conversation.since,
						openTodos: open.length,
						reports: [],
						mark: null,
						hasChildren: conversation.subagents.length > 0,
						now: Date.now(),
					});
				const agent: FilterableAgent = {
					state: work.state,
					projectId: assigned.projectId,
					projectStatus,
					focused: focused.has(workspace.id),
				};
				agents.push(agent);
				everyone.push({
					workspace,
					conversation,
					work,
					projectId: assigned.projectId,
				});
				if (!matchesOfficeFilter(agent, filter)) continue;
				const tone = work.state;
				const member: Member = {
					workspace,
					conversation,
					tone,
					work,
					topTodo: open[0]?.text ?? null,
					openTodos: open.length,
					helpers: conversation.subagents.filter(
						(subagent) => !subagent.workflow,
					),
				};
				desk.members.push(member);
				for (const subagent of conversation.subagents) {
					const run = subagent.workflow;
					if (!run) continue;
					let unit = desk.workflows.find((entry) => entry.runId === run.runId);
					if (!unit) {
						unit = {
							runId: run.runId,
							name: run.name ?? null,
							phase: run.phase ?? null,
							parent: member,
							agents: [],
						};
						desk.workflows.push(unit);
					}
					unit.agents.push(subagent);
					if (run.phase) unit.phase = run.phase;
				}
				desk.tones.push(tone);
			}
			// Only the desks where a shown agent sits.
			if (desk.members.length === 0) continue;
			let room = byKey.get(group.key);
			if (!room) {
				room = { ...group, desks: [], tones: [] };
				byKey.set(group.key, room);
			}
			room.desks.push(desk);
			room.tones.push(...desk.tones);
		}
		const shownRooms = orderIslands([...byKey.values()]).map((room) => ({
			...room,
			desks: orderIslands(room.desks),
		}));
		return { allRooms: shownRooms, shownRooms, agents, everyone, projectOf };
	}, [
		staffed,
		groups,
		labelsByHost,
		reports,
		showAgentTodos,
		filter,
		focused,
		roomsBy,
		projects,
		pullRequestMoves,
		manualProjects,
		pullRequestIndex,
		noProjectName,
	]);
	const facets = useMemo(() => facetCounts(agents, filter), [agents, filter]);
	const filtering = isFiltering(filter);

	const [worldSize, setWorldSize] = useState({ width: 0, height: 0 });
	const camera = useOfficeCamera(worldSize);
	const aspect =
		camera.viewport.height > 0
			? camera.viewport.width / camera.viewport.height
			: undefined;

	const { scene, seats, rooms, plates, helperSpots, workflowSpots } =
		useMemo(() => {
			const layout = layoutOffice({
				rooms: shownRooms.map((room) => ({
					id: room.key,
					desks: room.desks.map((desk) => ({
						id: desk.key,
						seats: desk.members.length,
						helpers: desk.members.map((member) => member.helpers.length),
						workflows: desk.workflows.map((workflow) => ({
							id: workflow.runId,
							agents: workflow.agents.length,
						})),
					})),
				})),
				devices: providers.length,
				...(aspect ? { aspect } : {}),
			});
			const agents: OfficeSceneAgent[] = [];
			const helpers: OfficeSceneHelper[] = [];
			const extraHelpers: OfficeScene["extraHelpers"] = [];
			const workflows: OfficeSceneWorkflow[] = [];
			const seats: (Member & { deskX: number; seatY: number })[] = [];
			const plates: { desk: OfficeDesk; unit: DeskUnit }[] = [];
			const helperSpots: {
				subagent: SidebarSubagent;
				parent: Member;
				at: Point;
				scale: number;
			}[] = [];
			const workflowSpots: { workflow: OfficeWorkflow; unit: WorkflowUnit }[] =
				[];
			const emptyDesks = new Set<string>();
			const rooms: {
				room: OfficeRoom;
				unit: RoomUnit;
				counts: IslandCounts;
			}[] = shownRooms.map((unit, roomIndex) => {
				const room = layout.rooms[roomIndex];
				if (!room) throw new Error("layoutOffice dropped a room");
				unit.desks.forEach((deskUnit, deskIndex) => {
					const desk = room.desks[deskIndex];
					if (!desk) throw new Error("layoutOffice dropped a desk");
					plates.push({ desk, unit: deskUnit });
					if (deskUnit.members.length === 0) emptyDesks.add(desk.id);
					deskUnit.members.forEach((member, seatIndex) => {
						const seat = desk.seats[seatIndex];
						if (!seat) return;
						agents.push({
							terminalId: member.conversation.terminalId,
							state: member.conversation.state,
							openTodos: member.openTodos,
							seed: seedFor(member.conversation.terminalId),
							seat,
							path: pathToCoffee(room, seat, layout),
						});
						seats.push({ ...member, deskX: seat.desk.x, seatY: seat.y });
						seat.helpers.forEach((at, helperIndex) => {
							const subagent = member.helpers[helperIndex];
							if (!subagent) return;
							helpers.push({
								id: subagent.id,
								seed: seedFor(subagent.id),
								at,
								parentDesk: seat.desk,
							});
							helperSpots.push({
								subagent,
								parent: member,
								at,
								scale: HELPER_SCALE,
							});
						});
						const lastHelper = seat.helpers.at(-1);
						if (seat.extraHelpers > 0 && lastHelper) {
							extraHelpers.push({
								at: { x: lastHelper.x + 0.9, y: lastHelper.y },
								count: seat.extraHelpers,
							});
						}
					});
					deskUnit.workflows.forEach((workflowUnit, workflowIndex) => {
						const workflow = desk.workflows[workflowIndex];
						if (!workflow) return;
						workflows.push({
							workflow,
							seeds: workflowUnit.agents.map((agent) => seedFor(agent.id)),
						});
						workflowSpots.push({ workflow, unit: workflowUnit });
						workflow.agents.forEach((at, agentIndex) => {
							const subagent = workflowUnit.agents[agentIndex];
							if (!subagent) return;
							helperSpots.push({
								subagent,
								parent: workflowUnit.parent,
								at,
								scale: WORKFLOW_SCALE,
							});
						});
					});
				});
				return { room, unit, counts: countTones(unit.tones) };
			});
			const scene: OfficeScene = {
				layout,
				rooms: rooms.map(({ room, unit }) => ({ room, color: unit.color })),
				emptyDesks,
				agents,
				helpers,
				extraHelpers,
				workflows,
				devices: providers.length,
			};
			return { scene, seats, rooms, plates, helperSpots, workflowSpots };
		}, [shownRooms, providers.length, aspect]);

	const px = TILE_SIZE * BASE_SCALE;
	const worldWidth = scene.layout.width * px;
	const worldHeight = scene.layout.height * px;
	useEffect(() => {
		setWorldSize((current) =>
			current.width === worldWidth && current.height === worldHeight
				? current
				: { width: worldWidth, height: worldHeight },
		);
	}, [worldWidth, worldHeight]);

	const { fit, zoomBy, focusRect, reveal } = camera;
	useEffect(() => {
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, [contenteditable=true]")) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === "+" || event.key === "=") zoomBy(1.25);
			else if (event.key === "-") zoomBy(0.8);
			else if (event.key === "0") fit();
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [fit, zoomBy]);

	const openSubagent = useCallback(
		(parent: Member, subagent: SidebarSubagent) => {
			void navigateToV2Workspace(parent.workspace.id, navigate, {
				search: {
					...buildSubagentSearch({
						terminalId: parent.conversation.terminalId,
						subagentId: subagent.id,
						agentId: parent.conversation.agentId,
						...(subagent.agentType ? { agentType: subagent.agentType } : {}),
					}),
					focusRequestId: crypto.randomUUID(),
				},
			});
		},
		[navigate],
	);

	const subagentCount = useMemo(
		() =>
			allRooms
				.flatMap((room) => room.desks)
				.flatMap((desk) => desk.members)
				.reduce((sum, member) => sum + member.conversation.subagents.length, 0),
		[allRooms],
	);
	// The header counts every open agent, whatever the filters hide.
	const totals = useMemo(
		() => countTones(agents.map((agent) => agent.state)),
		[agents],
	);

	const openConversation = useCallback(
		(workspaceId: string, terminalId: string) => {
			void navigateToV2Workspace(workspaceId, navigate, {
				search: { terminalId, focusRequestId: crypto.randomUUID() },
			});
		},
		[navigate],
	);

	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const onSeatKeyDown = (
		index: number,
		event: KeyboardEvent<HTMLButtonElement>,
	) => {
		const seat = seats[index];
		if (!seat) return;
		if (ARROW_KEYS.has(event.key)) {
			event.preventDefault();
			const points = seats.map((entry) => ({
				x: entry.deskX,
				y: entry.seatY,
			}));
			buttonRefs.current[
				moveFocus(points, index, event.key as ArrowKey)
			]?.focus();
		} else if (event.key === "i" || (event.key === "Enter" && event.altKey)) {
			event.preventDefault();
			setSelection({
				workspaceId: seat.workspace.id,
				terminalId: seat.conversation.terminalId,
			});
		} else if (event.key === "Escape" && selection) {
			event.preventDefault();
			setSelection(null);
		}
	};

	const selected = selection
		? reports
				.get(selection.workspaceId)
				?.conversations.find(
					(conversation) => conversation.terminalId === selection.terminalId,
				)
		: undefined;
	const selectedWorkspace = workspaces.find(
		(workspace) => workspace.id === selection?.workspaceId,
	);
	const selectedWorkStates = selection
		? reports.get(selection.workspaceId)?.workStates
		: undefined;
	const rackLeft = Math.min(...scene.layout.racks.map((rack) => rack.x));

	return (
		<div className="flex h-full min-h-0 flex-1">
			{staffed.map((workspace) => (
				<OfficeWorkspaceSource
					key={workspace.id}
					workspaceId={workspace.id}
					hostId={workspace.hostId}
					onReport={onReport}
				/>
			))}
			<div className="flex min-w-0 flex-1 flex-col">
				<PageHeader
					className="border-b border-border"
					contentClassName="gap-3"
					start={
						<>
							<LuBuilding2 className="size-4 text-muted-foreground" />
							<h1 className="text-sm font-medium">
								<Trans>Office</Trans>
							</h1>
							<span className="text-xs text-muted-foreground">
								{totals.needYou > 0 ? (
									<span className="font-medium text-amber-500">
										<Trans>{totals.needYou} waiting on you</Trans>
									</span>
								) : (
									<Trans>Nobody waiting on you</Trans>
								)}
								{" · "}
								<Trans>{totals.working} working</Trans>
								{subagentCount > 0 && (
									<>
										{" · "}
										<Trans>{subagentCount} subagents</Trans>
									</>
								)}
							</span>
						</>
					}
				/>
				<OfficeFilterBar
					counts={facets}
					projects={projects.map((project) => ({
						id: project.id,
						name: project.name,
						status: project.status ?? null,
					}))}
					filtering={filtering}
				/>
				<div
					ref={camera.viewportRef}
					{...camera.panHandlers}
					className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-[#2d2a3a] active:cursor-grabbing"
				>
					{camera.viewport.width > 0 && (
						<div
							className="absolute top-0 left-0 origin-top-left"
							style={{
								width: worldWidth,
								height: worldHeight,
								transform: `translate(${camera.camera.x}px, ${camera.camera.y}px) scale(${camera.camera.zoom})`,
							}}
						>
							<OfficeCanvas
								scene={scene}
								scale={BASE_SCALE}
								reducedMotion={reducedMotion}
							/>
							{rooms.map(({ room, unit, counts }) => (
								<OfficeRoomHeader
									key={room.id}
									name={unit.name}
									color={unit.color}
									counts={counts}
									project={
										unit.projectId === undefined
											? null
											: {
													statusLabel: (() => {
														const status = projects.find(
															(project) => project.id === unit.projectId,
														)?.status;
														return status ? statusLabels[status] : null;
													})(),
													statusColor: unit.color,
													pullRequests:
														pullRequestsByProject.get(unit.projectId)?.length ??
														0,
													hasNotion: projects.some(
														(project) =>
															project.id === unit.projectId &&
															!!project.notionUrl,
													),
													onOpenDetails: () =>
														openProjectPanel(unit.projectId as string),
												}
									}
									onFocusRoom={() =>
										focusRect({
											x: room.x * px,
											y: room.y * px,
											width: room.width * px,
											height: room.height * px,
										})
									}
									style={{
										left: room.header.x * px,
										top: room.header.y * px,
										width: room.header.width * px,
										height: HEADER_HEIGHT * px,
									}}
								/>
							))}
							{workflowSpots.map(({ workflow, unit }) => (
								<OfficeWorkflowLabel
									key={`${unit.parent.conversation.terminalId}:${workflow.id}`}
									name={unit.name}
									phase={unit.phase}
									agents={unit.agents.length}
									style={{
										left: workflow.label.x * px,
										top: workflow.label.y * px + 4,
										width: workflow.label.width * px,
										height: px - 4,
									}}
								/>
							))}
							{helperSpots.map(({ subagent, parent, at, scale }) => (
								<OfficeHelperButton
									key={`${parent.conversation.terminalId}:${subagent.id}`}
									label={
										subagent.workflow
											? (subagent.description ?? t`Workflow agent`)
											: (subagent.agentType ?? t`Subagent`)
									}
									description={
										subagent.workflow ? null : (subagent.description ?? null)
									}
									parentTitle={parent.conversation.title}
									onOpen={() => openSubagent(parent, subagent)}
									style={{
										left: at.x * px,
										top: at.y * px,
										width: TILE_SIZE * scale * BASE_SCALE,
										height: TILE_SIZE * scale * BASE_SCALE,
									}}
								/>
							))}
							{plates.map(({ desk, unit }) => {
								const tone = deskTone(unit.tones);
								const branch = unit.workspace.branch;
								return (
									<OfficeDeskPlate
										key={desk.id}
										workspaceId={unit.workspace.id}
										name={unit.name}
										branch={branch && branch !== unit.name ? branch : null}
										labels={unit.labels}
										project={
											roomsBy === "folders" &&
											unit.project.id !== OTHER_PROJECT_ID
												? unit.project.name
												: null
										}
										tone={tone}
										toneLabel={
											tone
												? WORK_STATES.flatMap((state) => {
														const count = unit.tones.filter(
															(entry) => entry === state,
														).length;
														return count > 0
															? [`${count} ${workWords.short[state]}`]
															: [];
													}).join(", ")
												: t`No chat running`
										}
										tones={unit.tones}
										onOpen={() =>
											void navigateToV2Workspace(unit.workspace.id, navigate)
										}
										style={{
											left: desk.plate.x * px + 2,
											top: desk.plate.y * px + 3,
											width: desk.plate.width * px - 4,
											height: PLATE_HEIGHT * px - 3,
										}}
									/>
								);
							})}
							{seats.map((seat, index) => (
								<OfficeSeatButton
									key={seat.conversation.terminalId}
									buttonRef={(element) => {
										buttonRefs.current[index] = element;
									}}
									tone={seat.tone}
									title={seat.conversation.title}
									toneLabel={toneLabels[seat.tone]}
									failed={seat.work.cause === "error"}
									pinned={seat.work.mark !== null}
									stateLabel={workWords.cause[seat.work.cause]}
									workspaceName={seat.workspace.name}
									topTodo={seat.topTodo}
									selected={
										selection?.terminalId === seat.conversation.terminalId
									}
									bubbleHeight={Math.round(px * 0.62)}
									onOpen={() =>
										openConversation(
											seat.workspace.id,
											seat.conversation.terminalId,
										)
									}
									onDetails={() =>
										setSelection({
											workspaceId: seat.workspace.id,
											terminalId: seat.conversation.terminalId,
										})
									}
									onKeyDown={(event) => onSeatKeyDown(index, event)}
									onFocus={() =>
										reveal({
											x: (seat.deskX - 0.4) * px,
											y: (seat.seatY - 1) * px,
											width: 2.8 * px,
											height: 3 * px,
										})
									}
									style={{
										left: (seat.deskX - 0.4) * px,
										top: (seat.seatY - 1) * px + 2,
										width: 2.8 * px,
										height: 3 * px - 4,
									}}
								/>
							))}
							<Tooltip delayDuration={150}>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label={t`Connections`}
										onClick={() => navigate({ to: "/settings/integrations" })}
										className="absolute rounded-sm outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring"
										style={{
											left: rackLeft * px,
											top:
												(scene.layout.racks[0]?.y ?? 0) * px - 6 * BASE_SCALE,
											width: scene.layout.racks.length * 3 * px - px,
											height: 2 * px + 4 * BASE_SCALE,
										}}
									/>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-64">
									<p className="font-medium">
										<Trans>Connections</Trans>
									</p>
									{providers.length > 0 ? (
										<p className="capitalize">{providers.join(", ")}</p>
									) : (
										<p className="opacity-70">
											<Trans>No integration connected yet.</Trans>
										</p>
									)}
								</TooltipContent>
							</Tooltip>
							{shownRooms.length === 0 && (
								<p
									className="absolute right-0 left-0 mx-auto max-w-sm rounded-md border-2 border-[#1d1a24] bg-[#f4f1ea] p-3 text-center text-xs text-[#1d1a24]"
									style={{ top: 5 * px }}
								>
									{agents.length === 0 ? (
										<Trans>
											No agent open right now. Start one in a workspace and it
											gets a desk here.
										</Trans>
									) : (
										<>
											<Trans>No open agent matches these filters.</Trans>{" "}
											{(filterStates.length > 0 ||
												filterProjects.length > 0 ||
												filterProjectStatuses.length > 0) && (
												<button
													type="button"
													onClick={clearFilters}
													className="font-bold underline"
												>
													<Trans>Clear them</Trans>
												</button>
											)}
										</>
									)}
								</p>
							)}
						</div>
					)}
					<OfficeCameraControls
						zoom={camera.camera.zoom}
						onZoomIn={() => zoomBy(1.25)}
						onZoomOut={() => zoomBy(0.8)}
						onFit={fit}
					/>
				</div>
				<footer className="flex h-7 shrink-0 items-center gap-2 border-t border-border px-4 text-[11px] text-muted-foreground">
					<Trans>
						Drag or scroll to move, pinch or ⌘-scroll to zoom, click a room's
						name to zoom on it · Click an agent to open its conversation, a
						small one for its subagent · Right-click, ⌥-click or I to set its
						state
					</Trans>
					<span>
						<Trans>· The target on a name plate puts it in focus</Trans>
					</span>
				</footer>
			</div>
			{selected && selectedWorkspace && selectedWorkStates && (
				<OfficeAgentPanel
					workspace={selectedWorkspace}
					conversation={selected}
					workStates={selectedWorkStates}
					project={
						projectOf.get(selectedWorkspace.id) ?? {
							id: OTHER_PROJECT_ID,
							name: t`No project`,
							via: null,
						}
					}
					projects={projects}
					onClose={() => setSelection(null)}
				/>
			)}
			{projectPanel !== null && (
				<OfficeProjectPanel
					project={
						projects.find((project) => project.id === projectPanel) ?? null
					}
					pullRequests={pullRequestsByProject.get(projectPanel) ?? []}
					specs={projectNotionSpecs(
						pullRequestsByProject.get(projectPanel) ?? [],
					)}
					agents={everyone
						.filter((entry) => entry.projectId === projectPanel)
						.map((entry) => ({
							terminalId: entry.conversation.terminalId,
							workspaceId: entry.workspace.id,
							title: entry.conversation.title,
							workspaceName: getV2WorkspaceDisplayName(entry.workspace),
							work: entry.work,
						}))}
					onOpenAgent={(workspaceId, terminalId) =>
						setSelection({ workspaceId, terminalId })
					}
					onClose={() => setProjectPanel(null)}
				/>
			)}
		</div>
	);
}

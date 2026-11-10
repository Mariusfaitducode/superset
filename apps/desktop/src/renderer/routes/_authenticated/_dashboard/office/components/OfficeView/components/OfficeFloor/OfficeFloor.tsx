import { Trans, useLingui } from "@lingui/react/macro";
import { Switch } from "@superset/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
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
import type { HostWorkspaceItem } from "renderer/hooks/host-workspaces/useHostWorkspaces";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
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
import { useConversationStateLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useConversationStateLabels";
import { useOfficeCamera } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeCamera";
import { useOfficeGroups } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeGroups";
import { useOfficeToneLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeToneLabels";
import { usePrefersReducedMotion } from "renderer/routes/_authenticated/_dashboard/office/hooks/usePrefersReducedMotion";
import { useOfficeFilterStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-filter";
import { seedFor } from "renderer/routes/_authenticated/_dashboard/office/utils/characterFrame";
import type {
	OfficeScene,
	OfficeSceneAgent,
	OfficeSceneHelper,
	OfficeSceneWorkflow,
} from "renderer/routes/_authenticated/_dashboard/office/utils/drawOffice";
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
	type ArrowKey,
	countTones,
	deskTone,
	type IslandCounts,
	moveFocus,
	type OfficeTone,
	orderIslands,
	toneFor,
	visibleIslands,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";
import {
	buildSubagentSearch,
	navigateToV2Workspace,
} from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";
import { OfficeAgentPanel } from "./components/OfficeAgentPanel";
import { OfficeCameraControls } from "./components/OfficeCameraControls";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OfficeDeskPlate } from "./components/OfficeDeskPlate";
import { OfficeHelperButton } from "./components/OfficeHelperButton";
import { OfficeRoomHeader } from "./components/OfficeRoomHeader";
import { OfficeSeatButton } from "./components/OfficeSeatButton";
import { OfficeWorkflowLabel } from "./components/OfficeWorkflowLabel";
import {
	type OfficeWorkspaceReport,
	OfficeWorkspaceSource,
} from "./components/OfficeWorkspaceSource";

/** CSS pixels per art pixel at 100% zoom. */
const BASE_SCALE = 2;

const LEGEND: { tone: OfficeTone; dot: string }[] = [
	{ tone: "need", dot: "bg-amber-400" },
	{ tone: "working", dot: "bg-yellow-300" },
	{ tone: "done", dot: "bg-green-500" },
	{ tone: "failed", dot: "bg-red-500" },
	{ tone: "idle", dot: "bg-zinc-400" },
];

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
}

/** One group (sidebar folder or project): a room. */
interface RoomUnit {
	key: string;
	name: string;
	color: string | null;
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
	const stateLabels = useConversationStateLabels();
	const toneLabels = useOfficeToneLabels();
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const statuses = useSidebarWorkspaceStatuses();
	const onlyNeedsMe = useOfficeFilterStore((state) => state.onlyNeedsMe);
	const setOnlyNeedsMe = useOfficeFilterStore((state) => state.setOnlyNeedsMe);

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

	const [selection, setSelection] = useState<Selection | null>(null);

	const { allRooms, shownRooms } = useMemo(() => {
		const byKey = new Map<string, RoomUnit>();
		for (const workspace of workspaces) {
			const group = groups.get(workspace.id) ?? {
				key: `workspace:${workspace.id}`,
				name: workspace.name,
				color: null,
			};
			let room = byKey.get(group.key);
			if (!room) {
				room = { ...group, desks: [], tones: [] };
				byKey.set(group.key, room);
			}
			const desk: DeskUnit = {
				key: workspace.id,
				name: getV2WorkspaceDisplayName(workspace),
				workspace,
				members: [],
				workflows: [],
				tones: [],
				labels: workspaceLabels(
					labelsByHost.get(workspace.hostId),
					workspace.id,
				),
			};
			const report = reports.get(workspace.id);
			for (const conversation of report?.conversations ?? []) {
				const open = (
					report?.todosByTerminal?.get(conversation.terminalId) ?? []
				)
					.filter((todo) => showAgentTodos || todo.author !== "agent")
					.filter((todo) => !todo.done);
				const tone = toneFor(conversation.state);
				const member: Member = {
					workspace,
					conversation,
					tone,
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
				room.tones.push(tone);
			}
			room.desks.push(desk);
		}
		const allRooms = orderIslands([...byKey.values()]).map((room) => ({
			...room,
			desks: orderIslands(room.desks),
		}));
		const shownRooms = allRooms
			.map((room) => ({
				...room,
				desks: visibleIslands(room.desks, onlyNeedsMe),
			}))
			.filter((room) => room.desks.length > 0);
		return { allRooms, shownRooms };
	}, [workspaces, groups, labelsByHost, reports, showAgentTodos, onlyNeedsMe]);

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
	const totals = useMemo(
		() => countTones(allRooms.flatMap((room) => room.tones)),
		[allRooms],
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
				<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
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
					<label
						htmlFor="office-only-needs-me"
						className="ml-auto flex cursor-pointer items-center gap-2 text-xs"
					>
						<Switch
							id="office-only-needs-me"
							checked={onlyNeedsMe}
							onCheckedChange={setOnlyNeedsMe}
						/>
						<Trans>Only who needs me</Trans>
					</label>
					<ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						{LEGEND.map(({ tone, dot }) => (
							<li key={tone} className="flex items-center gap-1.5">
								<span className={cn("size-2 rounded-full", dot)} />
								{toneLabels[tone]}
							</li>
						))}
					</ul>
				</header>
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
										name={unit.name}
										branch={branch && branch !== unit.name ? branch : null}
										labels={unit.labels}
										tone={tone}
										toneLabel={tone ? toneLabels[tone] : t`No chat running`}
										chats={unit.members.length}
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
									stateLabel={stateLabels[seat.conversation.state]}
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
									{workspaces.length === 0 ? (
										<Trans>
											No workspace yet. Create one and it gets a desk here.
										</Trans>
									) : (
										<Trans>Nobody needs you right now.</Trans>
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
						small one for its subagent · ⌥-click or I for details
					</Trans>
				</footer>
			</div>
			{selected && selectedWorkspace && (
				<OfficeAgentPanel
					workspace={selectedWorkspace}
					conversation={selected}
					onClose={() => setSelection(null)}
				/>
			)}
		</div>
	);
}

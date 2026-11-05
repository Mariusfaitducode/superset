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
import type { SidebarConversation } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import {
	useLabelsByHost,
	type WorkspaceLabel,
	workspaceLabels,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels";
import { useSidebarWorkspaceStatuses } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useConversationStateLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useConversationStateLabels";
import { useOfficeGroups } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeGroups";
import { useOfficeToneLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeToneLabels";
import { usePrefersReducedMotion } from "renderer/routes/_authenticated/_dashboard/office/hooks/usePrefersReducedMotion";
import { useOfficeFilterStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-filter";
import { seedFor } from "renderer/routes/_authenticated/_dashboard/office/utils/characterFrame";
import type {
	OfficeScene,
	OfficeSceneAgent,
} from "renderer/routes/_authenticated/_dashboard/office/utils/drawOffice";
import {
	HEADER_HEIGHT,
	layoutOffice,
	pathToCoffee,
	TILE_SIZE,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeLayout";
import {
	type ArrowKey,
	countTones,
	moveFocus,
	type OfficeTone,
	orderIslands,
	toneFor,
	visibleIslands,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { OfficeAgentPanel } from "./components/OfficeAgentPanel";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OfficeIslandHeader } from "./components/OfficeIslandHeader";
import { OfficeSeatButton } from "./components/OfficeSeatButton";
import {
	type OfficeWorkspaceReport,
	OfficeWorkspaceSource,
} from "./components/OfficeWorkspaceSource";

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

interface Member {
	workspace: HostWorkspaceItem;
	conversation: SidebarConversation;
	tone: OfficeTone;
	topTodo: string | null;
	openTodos: number;
}

interface GroupIsland {
	key: string;
	name: string;
	color: string | null;
	members: Member[];
	tones: OfficeTone[];
	labels: WorkspaceLabel[];
	workspaceNames: string[];
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

	const staffed = useMemo(
		() =>
			workspaces
				.filter(
					(workspace) => (statuses.get(workspace.id)?.bindings.size ?? 0) > 0,
				)
				.sort((a, b) => a.name.localeCompare(b.name)),
		[workspaces, statuses],
	);
	const groups = useOfficeGroups(staffed);

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
		() => staffed.map((workspace) => workspace.hostId),
		[staffed],
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

	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setContainerWidth(entry.contentRect.width);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);
	const scale = containerWidth >= 1400 ? 3 : 2;

	const [selection, setSelection] = useState<Selection | null>(null);

	const { allIslands, shownIslands } = useMemo(() => {
		const byKey = new Map<string, GroupIsland>();
		for (const workspace of staffed) {
			const group = groups.get(workspace.id) ?? {
				key: `workspace:${workspace.id}`,
				name: workspace.name,
				color: null,
			};
			let island = byKey.get(group.key);
			if (!island) {
				island = {
					...group,
					members: [],
					tones: [],
					labels: [],
					workspaceNames: [],
				};
				byKey.set(group.key, island);
			}
			island.workspaceNames.push(workspace.name);
			for (const label of workspaceLabels(
				labelsByHost.get(workspace.hostId),
				workspace.id,
			)) {
				if (!island.labels.some((known) => known.name === label.name)) {
					island.labels.push(label);
				}
			}
			const report = reports.get(workspace.id);
			for (const conversation of report?.conversations ?? []) {
				const open = (
					report?.todosByTerminal?.get(conversation.terminalId) ?? []
				)
					.filter((todo) => showAgentTodos || todo.author !== "agent")
					.filter((todo) => !todo.done);
				const tone = toneFor(conversation.state);
				island.members.push({
					workspace,
					conversation,
					tone,
					topTodo: open[0]?.text ?? null,
					openTodos: open.length,
				});
				island.tones.push(tone);
			}
		}
		const allIslands = orderIslands([...byKey.values()]);
		return {
			allIslands,
			shownIslands: visibleIslands(allIslands, onlyNeedsMe),
		};
	}, [staffed, groups, labelsByHost, reports, showAgentTodos, onlyNeedsMe]);

	const { scene, seats, headers } = useMemo(() => {
		const layout = layoutOffice({
			islands: shownIslands.map((island) => ({
				id: island.key,
				seats: Math.max(island.members.length, 1),
			})),
			maxWidth: containerWidth / (TILE_SIZE * scale),
			devices: providers.length,
		});
		const agents: OfficeSceneAgent[] = [];
		const seats: (Member & { deskX: number; seatY: number })[] = [];
		const headers = shownIslands.map((group, index) => {
			const island = layout.islands[index];
			if (!island) throw new Error("layoutOffice dropped an island");
			group.members.forEach((member, seatIndex) => {
				const seat = island.seats[seatIndex];
				if (!seat) return;
				agents.push({
					terminalId: member.conversation.terminalId,
					state: member.conversation.state,
					openTodos: member.openTodos,
					seed: seedFor(member.conversation.terminalId),
					seat,
					path: pathToCoffee(island, seat, layout),
				});
				seats.push({ ...member, deskX: seat.desk.x, seatY: seat.y });
			});
			return { island, group, counts: countTones(group.tones) };
		});
		const scene: OfficeScene = {
			layout,
			islands: headers.map(({ island, group }) => ({
				island,
				color: group.color,
			})),
			agents,
			devices: providers.length,
		};
		return { scene, seats, headers };
	}, [shownIslands, containerWidth, scale, providers.length]);

	const totals = useMemo(
		() => countTones(allIslands.flatMap((island) => island.tones)),
		[allIslands],
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

	const px = TILE_SIZE * scale;
	const selected = selection
		? reports
				.get(selection.workspaceId)
				?.conversations.find(
					(conversation) => conversation.terminalId === selection.terminalId,
				)
		: undefined;
	const selectedWorkspace = staffed.find(
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
					ref={containerRef}
					className="relative min-h-0 flex-1 overflow-auto"
				>
					{containerWidth > 0 && (
						<div
							className="relative"
							style={{
								width: scene.layout.width * px,
								height: scene.layout.height * px,
							}}
						>
							<OfficeCanvas
								scene={scene}
								scale={scale}
								reducedMotion={reducedMotion}
							/>
							{headers.map(({ island, group, counts }) => (
								<OfficeIslandHeader
									key={island.id}
									name={group.name}
									color={group.color}
									labels={group.labels}
									workspaceNames={group.workspaceNames}
									counts={counts}
									style={{
										left: island.header.x * px,
										top: island.header.y * px,
										width: island.header.width * px,
										height: HEADER_HEIGHT * px,
									}}
								/>
							))}
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
											top: (scene.layout.racks[0]?.y ?? 0) * px - 6 * scale,
											width: scene.layout.racks.length * 3 * px - px,
											height: 2 * px + 4 * scale,
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
							{shownIslands.length === 0 && (
								<p
									className="absolute right-0 left-0 mx-auto max-w-sm rounded-md border-2 border-[#1d1a24] bg-[#f4f1ea] p-3 text-center text-xs text-[#1d1a24]"
									style={{ top: 5 * px }}
								>
									{staffed.length === 0 ? (
										<Trans>
											No agent is running. Start one in a workspace and it takes
											a desk here.
										</Trans>
									) : (
										<Trans>Nobody needs you right now.</Trans>
									)}
								</p>
							)}
						</div>
					)}
				</div>
				<footer className="flex h-7 shrink-0 items-center gap-2 border-t border-border px-4 text-[11px] text-muted-foreground">
					<Trans>
						Click an agent to open its conversation · ⌥-click, right-click or I
						for details · Tab or arrows to move, Enter to open
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

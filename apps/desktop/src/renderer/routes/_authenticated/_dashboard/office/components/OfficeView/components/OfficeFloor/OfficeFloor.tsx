import { Trans, useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuBuilding2 } from "react-icons/lu";
import type { HostWorkspaceItem } from "renderer/hooks/host-workspaces/useHostWorkspaces";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import type { SidebarConversation } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import {
	useLabelsByHost,
	workspaceLabels,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels";
import { useSidebarWorkspaceStatuses } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useConversationStateLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useConversationStateLabels";
import { usePrefersReducedMotion } from "renderer/routes/_authenticated/_dashboard/office/hooks/usePrefersReducedMotion";
import { seedFor } from "renderer/routes/_authenticated/_dashboard/office/utils/characterFrame";
import type {
	OfficeScene,
	OfficeSceneAgent,
} from "renderer/routes/_authenticated/_dashboard/office/utils/drawOffice";
import {
	layoutOffice,
	pathToCoffee,
	TILE_SIZE,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeLayout";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { OfficeAgentPanel } from "./components/OfficeAgentPanel";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OfficeSeatButton } from "./components/OfficeSeatButton";
import {
	type OfficeWorkspaceReport,
	OfficeWorkspaceSource,
} from "./components/OfficeWorkspaceSource";

const LEGEND: { state: ConversationState; dot: string }[] = [
	{ state: "working", dot: "bg-yellow-400" },
	{ state: "request", dot: "bg-violet-500" },
	{ state: "failed", dot: "bg-red-500" },
	{ state: "unseen", dot: "bg-green-500" },
	{ state: "seen", dot: "bg-blue-500" },
	{ state: "idle", dot: "bg-muted-foreground/40" },
];

interface Selection {
	workspaceId: string;
	terminalId: string;
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
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const statuses = useSidebarWorkspaceStatuses();

	const staffed = useMemo(
		() =>
			workspaces
				.filter(
					(workspace) => (statuses.get(workspace.id)?.bindings.size ?? 0) > 0,
				)
				.sort((a, b) => a.name.localeCompare(b.name)),
		[workspaces, statuses],
	);

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

	const { scene, seats } = useMemo(() => {
		const rows = staffed.map((workspace) => ({
			workspace,
			conversations: reports.get(workspace.id)?.conversations ?? [],
			todosByTerminal: reports.get(workspace.id)?.todosByTerminal ?? null,
		}));
		const layout = layoutOffice({
			islands: rows.map((row) => ({
				id: row.workspace.id,
				seats: Math.max(row.conversations.length, 1),
			})),
			maxWidth: containerWidth / (TILE_SIZE * scale),
			devices: providers.length,
		});
		const agents: OfficeSceneAgent[] = [];
		const seats: {
			workspace: HostWorkspaceItem;
			conversation: SidebarConversation;
			topTodo: string | null;
			left: number;
			top: number;
		}[] = [];
		const islands = rows.map((row, index) => {
			const island = layout.islands[index];
			if (!island) throw new Error("layoutOffice dropped an island");
			row.conversations.forEach((conversation, seatIndex) => {
				const seat = island.seats[seatIndex];
				if (!seat) return;
				const open = (row.todosByTerminal?.get(conversation.terminalId) ?? [])
					.filter((todo) => showAgentTodos || todo.author !== "agent")
					.filter((todo) => !todo.done);
				agents.push({
					terminalId: conversation.terminalId,
					state: conversation.state,
					openTodos: open.length,
					seed: seedFor(conversation.terminalId),
					seat,
					path: pathToCoffee(island, seat, layout),
				});
				seats.push({
					workspace: row.workspace,
					conversation,
					topTodo: open[0]?.text ?? null,
					left: seat.desk.x,
					top: seat.y,
				});
			});
			const label = workspaceLabels(
				labelsByHost.get(row.workspace.hostId),
				row.workspace.id,
			)[0];
			return { island, color: label?.color ?? null, workspace: row.workspace };
		});
		const scene: OfficeScene = {
			layout,
			islands,
			agents,
			devices: providers.length,
		};
		return { scene, seats };
	}, [
		staffed,
		reports,
		containerWidth,
		scale,
		providers.length,
		labelsByHost,
		showAgentTodos,
	]);

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
					<ul className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						{LEGEND.map(({ state, dot }) => (
							<li key={state} className="flex items-center gap-1.5">
								<span className={cn("size-2 rounded-full", dot)} />
								{stateLabels[state]}
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
							{scene.islands.map(({ island, workspace }) => (
								<button
									key={island.id}
									type="button"
									onClick={() =>
										void navigateToV2Workspace(workspace.id, navigate)
									}
									title={t`Open ${workspace.name}`}
									className="absolute truncate border-2 border-[#1d1a24] bg-[#f4f1ea] px-1 font-mono text-[11px] leading-none text-[#1d1a24] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									style={{
										left: island.plate.x * px,
										top: island.plate.y * px + px * 0.15,
										width: island.plate.width * px,
										height: px * 0.7,
									}}
								>
									{workspace.name}
								</button>
							))}
							{seats.map(({ workspace, conversation, topTodo, left, top }) => (
								<OfficeSeatButton
									key={conversation.terminalId}
									title={conversation.title}
									stateLabel={stateLabels[conversation.state]}
									topTodo={topTodo}
									selected={selection?.terminalId === conversation.terminalId}
									onSelect={() =>
										setSelection({
											workspaceId: workspace.id,
											terminalId: conversation.terminalId,
										})
									}
									style={{
										left: left * px,
										top: top * px,
										width: 2 * px,
										height: 2 * px,
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
							{staffed.length === 0 && (
								<p
									className="absolute right-0 left-0 mx-auto max-w-sm rounded-md border-2 border-[#1d1a24] bg-[#f4f1ea] p-3 text-center text-xs text-[#1d1a24]"
									style={{ top: 5 * px }}
								>
									<Trans>
										No agent is running. Start one in a workspace and it takes a
										desk here.
									</Trans>
								</p>
							)}
						</div>
					)}
				</div>
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

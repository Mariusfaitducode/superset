import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
	LuBriefcase,
	LuCalendarClock,
	LuExternalLink,
	LuFileText,
	LuGauge,
	LuMessageSquare,
	LuPlay,
	LuSparkles,
	LuX,
} from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useObserverMissionLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useObserverMissionLabels";
import type { useOfficeObserver } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeObserver";
import {
	groupFindings,
	type ObserverFinding,
	type ObserverMission,
} from "renderer/routes/_authenticated/_dashboard/office/utils/observerStatus";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { ObserverStatusLine } from "../OfficeObserverDesk";

const MISSION_ICON: Record<
	ObserverMission,
	ComponentType<{ className?: string }>
> = {
	work: LuBriefcase,
	efficiency: LuGauge,
	superset: LuSparkles,
};

/** The observer's latest synthesis, grouped by mission, and its controls. */
export function OfficeObserverPanel({
	observer,
	onClose,
}: {
	observer: ReturnType<typeof useOfficeObserver>;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const missionLabels = useObserverMissionLabels();
	const openUrl = electronTrpc.external.openUrl.useMutation();
	const openFile = electronTrpc.external.openFileInEditor.useMutation();
	const { status, synthesis, runs } = observer;
	const busy = status.kind === "starting" || status.kind === "running";
	const lastRun = runs[0] ?? null;
	const groups = groupFindings(synthesis?.synthesis?.findings ?? []);
	const file = synthesis?.synthesis?.file ?? null;

	const openConversation = (workspaceId: string, terminalId: string | null) => {
		void navigateToV2Workspace(workspaceId, navigate, {
			search: terminalId
				? { terminalId, focusRequestId: crypto.randomUUID() }
				: {},
		});
	};

	return (
		<aside className="flex w-96 shrink-0 flex-col border-l border-border bg-background">
			<div className="flex items-start gap-2 border-b border-border p-3">
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium">
						<Trans>Observer</Trans>
					</p>
					<p className="truncate text-xs text-muted-foreground">
						<ObserverStatusLine status={status} />
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={t`Close`}
					onClick={onClose}
				>
					<LuX className="size-3.5" />
				</Button>
			</div>

			{!observer.available ? (
				<p className="p-3 text-xs text-muted-foreground">
					<Trans>This host is too old to run the observer.</Trans>
				</p>
			) : (
				<>
					<div className="flex flex-col gap-2 border-b border-border p-3">
						<div className="flex gap-2">
							<Button
								size="sm"
								className="flex-1"
								disabled={busy || !observer.agentId}
								onClick={() => observer.run()}
							>
								<LuPlay className="size-3.5" />
								{busy ? <Trans>Running…</Trans> : <Trans>Run now</Trans>}
							</Button>
							{lastRun && (
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										openConversation(lastRun.workspaceId, lastRun.terminalId)
									}
								>
									<LuMessageSquare className="size-3.5" />
									<Trans>Conversation</Trans>
								</Button>
							)}
						</div>
						{observer.agents.length > 1 && observer.agentId && (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span id="observer-agent-label" className="shrink-0">
									<Trans>Runs with</Trans>
								</span>
								<Select
									value={observer.agentId}
									onValueChange={(value) => observer.setAgent(value)}
								>
									<SelectTrigger
										size="sm"
										aria-labelledby="observer-agent-label"
										className="h-7 flex-1 text-xs"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{observer.agents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
						{observer.agents.length === 0 && (
							<p className="text-xs text-muted-foreground">
								<Trans>
									Add a Claude agent in Settings → Agents to run it.
								</Trans>
							</p>
						)}
						{observer.runError && (
							<p className="text-xs text-destructive">
								{observer.runError.message}
							</p>
						)}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto p-3">
						{synthesis?.synthesis ? (
							<>
								<p className="text-sm leading-snug">
									{synthesis.synthesis.headline}
								</p>
								{file && (
									<button
										type="button"
										onClick={() => openFile.mutate({ path: file })}
										className="mt-1 flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
									>
										<LuFileText className="size-3 shrink-0" />
										<span className="truncate">
											<Trans>Full synthesis</Trans>
										</span>
									</button>
								)}
								{groups.length === 0 && (
									<p className="mt-3 text-xs text-muted-foreground">
										<Trans>Nothing to flag.</Trans>
									</p>
								)}
								{groups.map(({ mission, findings }) => {
									const Icon = MISSION_ICON[mission];
									return (
										<section key={mission} className="mt-4">
											<h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
												<Icon className="size-3.5" />
												{missionLabels[mission]}
											</h2>
											<ul className="flex flex-col gap-1.5">
												{findings.map((finding, index) => (
													<FindingRow
														// Findings have no id; a run's list never reorders.
														// biome-ignore lint/suspicious/noArrayIndexKey: see above
														key={index}
														finding={finding}
														onOpenLink={(url) => openUrl.mutate(url)}
														onOpenConversation={openConversation}
													/>
												))}
											</ul>
										</section>
									);
								})}
							</>
						) : (
							<div className="flex flex-col gap-2 text-xs text-muted-foreground">
								<p>
									<Trans>
										The observer reads every agent of this Mac (states, to-dos,
										reports, notes, Superset ideas, your PRs and messages) and
										hands you one synthesis: what to improve in Superset, what
										waits on you, and how to make your agents cheaper and
										faster.
									</Trans>
								</p>
								<p>
									<Trans>
										It only reads. Anything to send in your name comes back as a
										draft on your Desk.
									</Trans>
								</p>
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={() => navigate({ to: "/relais" })}
						className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-left text-[11px] text-muted-foreground hover:text-foreground"
					>
						<LuCalendarClock className="size-3.5 shrink-0" />
						<Trans>Schedule it in My automations</Trans>
					</button>
				</>
			)}
		</aside>
	);
}

function FindingRow({
	finding,
	onOpenLink,
	onOpenConversation,
}: {
	finding: ObserverFinding;
	onOpenLink: (url: string) => void;
	onOpenConversation: (workspaceId: string, terminalId: string | null) => void;
}) {
	const { t } = useLingui();
	const { workspaceId, link } = finding;
	return (
		<li
			className={cn(
				"rounded-md border border-border p-2",
				finding.priority === "high" && "border-l-4 border-l-amber-400",
			)}
		>
			<p className="text-xs font-medium leading-snug">{finding.title}</p>
			{finding.detail && (
				<p className="mt-0.5 text-xs leading-snug text-muted-foreground">
					{finding.detail}
				</p>
			)}
			{(workspaceId || link) && (
				<div className="mt-1.5 flex gap-1">
					{workspaceId && (
						<Button
							size="xs"
							variant="outline"
							onClick={() =>
								onOpenConversation(workspaceId, finding.terminalId)
							}
						>
							<LuMessageSquare className="size-3" />
							<Trans>Open</Trans>
						</Button>
					)}
					{link && (
						<Button
							size="xs"
							variant="outline"
							aria-label={t`Open link`}
							title={link}
							onClick={() => onOpenLink(link)}
						>
							<LuExternalLink className="size-3" />
							<Trans>Link</Trans>
						</Button>
					)}
				</div>
			)}
		</li>
	);
}

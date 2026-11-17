import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	FLEET_GROUPS,
	type FleetGroup,
	type FleetStats,
} from "@superset/shared/agent-fleet-stats";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	LuArrowUpRight,
	LuBot,
	LuCpu,
	LuMonitor,
	LuServer,
	LuUsers,
} from "react-icons/lu";
import { useWorkStateLabels } from "renderer/components/WorkState";
import { WORK_STATE_COLOR_VAR, type WorkState } from "renderer/lib/agent-state";
import { useOfficeFilterStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-filter";
import { UNKNOWN_MODEL } from "renderer/routes/_authenticated/_dashboard/office/utils/officeFilters";

export interface OfficeStatsHost {
	name: string;
	isLocal: boolean;
}

const GROUP_ORDER: FleetGroup[] = [
	"working",
	"waiting",
	"toResume",
	"toCheck",
	"toClose",
];

function sameStates(a: readonly WorkState[], b: readonly WorkState[]) {
	return a.length === b.length && b.every((state) => a.includes(state));
}

/**
 * Every open agent at a glance, whatever the filters hide: by what the user
 * does next, by host, by model, with their subagents and tokens. Each number
 * filters the Office to the agents it counts; a second click shows all again.
 */
export function OfficeStatsStrip({
	stats,
	hosts,
	modelsUnavailable,
}: {
	stats: FleetStats;
	hosts: ReadonlyMap<string, OfficeStatsHost>;
	/** No host could tell its agents' models (too old or unreachable). */
	modelsUnavailable: boolean;
}) {
	const { t } = useLingui();
	const { formatCompactNumber, formatCurrency, formatNumber } = useFormat();
	const words = useWorkStateLabels();
	const filter = useOfficeFilterStore();

	const groupWords: Record<FleetGroup, { label: string; hint: string }> = {
		working: { label: t`Working`, hint: words.hint.working },
		waiting: { label: t`Waiting for you`, hint: words.hint.waiting },
		toResume: {
			label: t`To resume`,
			hint: t`${words.label.todos}: ${stats.byState.todos} · ${words.label.resume}: ${stats.byState.resume}`,
		},
		toCheck: { label: t`To check`, hint: words.hint.check },
		toClose: { label: t`To close`, hint: words.hint.done },
	};

	const tokens =
		stats.usage.inputTokens +
		stats.usage.cachedInputTokens +
		stats.usage.outputTokens;

	return (
		<div className="flex shrink-0 flex-wrap items-stretch gap-x-3 gap-y-1.5 border-b border-border px-4 py-1.5">
			<Group label={t`Agents`}>
				<Stat
					value={stats.open}
					label={t`Open`}
					active={filter.states.length === 0 && !filter.withChildren}
					hint={t`Every open agent. Click to show every state again.`}
					onClick={() => filter.soloStates([])}
				/>
				{GROUP_ORDER.map((group) => {
					const states = FLEET_GROUPS[group];
					const first = states[0];
					return (
						<Stat
							key={group}
							value={stats.groups[group]}
							label={groupWords[group].label}
							hint={groupWords[group].hint}
							color={WORK_STATE_COLOR_VAR[first]}
							active={sameStates(filter.states, states)}
							onClick={() => filter.soloStates(states)}
						/>
					);
				})}
			</Group>
			<Divider />
			<Group label={t`Helpers`}>
				<Stat
					value={stats.subagents + stats.workflowAgents}
					label={t`Subagents`}
					icon={<LuUsers className="size-3" />}
					active={filter.withChildren}
					hint={t`${stats.subagents} subagents and ${stats.workflowAgents} workflow agents, run by ${stats.withChildren} open agents. Click to show only those agents.`}
					onClick={filter.toggleWithChildren}
				/>
			</Group>
			{stats.hosts.length > 0 && (
				<>
					<Divider />
					<Group label={t`Hosts`}>
						{stats.hosts.map((host) => {
							const known = hosts.get(host.hostId);
							return (
								<Stat
									key={host.hostId}
									value={host.open}
									label={known?.name ?? t`Unknown host`}
									icon={
										known?.isLocal ? (
											<LuMonitor className="size-3" />
										) : (
											<LuServer className="size-3" />
										)
									}
									active={filter.hosts.includes(host.hostId)}
									hint={t`${host.working} working, ${host.waiting} waiting for you`}
									onClick={() => filter.soloHost(host.hostId)}
								/>
							);
						})}
					</Group>
				</>
			)}
			<Divider />
			<Group label={t`Models`}>
				{modelsUnavailable ? (
					<span className="flex h-7 items-center text-xs text-muted-foreground">
						<Trans>Unavailable on these hosts</Trans>
					</span>
				) : (
					<>
						{stats.models.map((model) => (
							<Stat
								key={model.model}
								value={model.open}
								label={model.model}
								icon={<LuCpu className="size-3" />}
								active={filter.models.includes(model.model)}
								hint={t`Open agents whose latest answer came from ${model.model}: ${model.working} working`}
								onClick={() => filter.soloModel(model.model)}
							/>
						))}
						{stats.unknownModel > 0 && (
							<Stat
								value={stats.unknownModel}
								label={t`Unknown`}
								icon={<LuBot className="size-3" />}
								active={filter.models.includes(UNKNOWN_MODEL)}
								hint={t`No answer in its transcript yet, an agent that keeps none, or a host too old to tell.`}
								onClick={() => filter.soloModel(UNKNOWN_MODEL)}
							/>
						)}
					</>
				)}
			</Group>
			{stats.usage.agents > 0 && (
				<>
					<Divider />
					<Tooltip delayDuration={300}>
						<TooltipTrigger asChild>
							<Link
								to="/usage"
								className="flex h-7 items-center gap-1.5 self-end rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
							>
								<span className="font-medium tabular-nums text-foreground">
									{formatCompactNumber(tokens)}
								</span>
								<Trans>tokens</Trans>
								{stats.usage.costUsd !== null && (
									<span className="tabular-nums">
										≈ {formatCurrency(stats.usage.costUsd, "USD")}
									</span>
								)}
								<LuArrowUpRight className="size-3" />
							</Link>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-72">
							<p className="font-medium">
								<Trans>
									Since they started, for {stats.usage.agents} of {stats.open}{" "}
									open agents
								</Trans>
							</p>
							<p className="opacity-80">
								<Trans>
									Input {formatNumber(stats.usage.inputTokens)}, cached{" "}
									{formatNumber(stats.usage.cachedInputTokens)}, output{" "}
									{formatNumber(stats.usage.outputTokens)}.
								</Trans>
							</p>
							<p className="opacity-80">
								<Trans>
									Cost is an estimate at API list rates, not money spent.
								</Trans>
							</p>
							<p className="mt-1 opacity-60">
								<Trans>Click for usage by day and model.</Trans>
							</p>
						</TooltipContent>
					</Tooltip>
				</>
			)}
		</div>
	);
}

function Group({ label, children }: { label: string; children: ReactNode }) {
	return (
		<fieldset
			aria-label={label}
			className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0"
		>
			{children}
		</fieldset>
	);
}

function Divider() {
	return <span aria-hidden className="my-1.5 w-px self-stretch bg-border" />;
}

function Stat({
	value,
	label,
	hint,
	active,
	onClick,
	color,
	icon,
}: {
	value: number;
	label: string;
	hint: string;
	active: boolean;
	onClick: () => void;
	color?: string;
	icon?: ReactNode;
}) {
	return (
		<Tooltip delayDuration={400}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-pressed={active}
					onClick={onClick}
					className={cn(
						"flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						active
							? "bg-accent text-foreground"
							: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
						value === 0 && !active && "opacity-50",
					)}
				>
					{color && (
						<span
							aria-hidden
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: color }}
						/>
					)}
					{icon}
					<span className="text-sm font-semibold tabular-nums text-foreground">
						{value}
					</span>
					<span className="truncate">{label}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="max-w-64">
				{hint}
			</TooltipContent>
		</Tooltip>
	);
}

import { Trans, useLingui } from "@lingui/react/macro";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@superset/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { MouseEvent, ReactNode } from "react";
import { LuChevronDown, LuFolderKanban, LuX } from "react-icons/lu";
import {
	useWorkStateLabels,
	WorkStateIcon,
} from "renderer/components/WorkState";
import { WorkspaceFocusFilterChip } from "renderer/components/WorkspaceFocus";
import {
	WORK_STATES,
	type WorkState,
	workStateColorVar,
} from "renderer/lib/agent-state";
import {
	PROJECT_STATUS_COLOR,
	useProjectStatusLabels,
} from "renderer/routes/_authenticated/_dashboard/office/hooks/useProjectStatusLabels";
import {
	type OfficeRooms,
	useOfficeFilterStore,
} from "renderer/routes/_authenticated/_dashboard/office/stores/office-filter";
import {
	type FacetCounts,
	NO_STATUS,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeFilters";
import {
	OTHER_PROJECT_ID,
	PROJECT_STATUSES,
	type ProjectStatus,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";

export interface OfficeFilterProject {
	id: string;
	name: string;
	status: ProjectStatus | null;
}

/**
 * The office's filters on one row: a chip per state (with how many agents
 * it adds), projects, project status, focus, and what rooms stand for.
 * ⌥-click a state chip to show only that state.
 */
export function OfficeFilterBar({
	counts,
	projects,
	filtering,
}: {
	counts: FacetCounts;
	projects: readonly OfficeFilterProject[];
	filtering: boolean;
}) {
	const { t } = useLingui();
	const words = useWorkStateLabels();
	const statusLabels = useProjectStatusLabels();
	const filter = useOfficeFilterStore();

	const onStateClick = (state: WorkState, event: MouseEvent) => {
		if (event.altKey) filter.soloState(state);
		else filter.toggleState(state);
	};

	const projectNames = new Map(
		projects.map((project) => [project.id, project.name]),
	);
	projectNames.set(OTHER_PROJECT_ID, t`No project`);
	const projectSummary =
		filter.projects.length === 0
			? t`All projects`
			: filter.projects.length === 1
				? (projectNames.get(filter.projects[0] ?? "") ?? t`1 project`)
				: t`${filter.projects.length} projects`;
	const statusSummary =
		filter.projectStatuses.length === 0
			? t`Any project status`
			: filter.projectStatuses
					.map(
						(status) =>
							statusLabels[status as ProjectStatus | "none"] ?? status,
					)
					.join(", ");

	return (
		<div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-1.5">
			<fieldset
				aria-label={t`Filter by state`}
				className="flex flex-wrap items-center gap-1"
			>
				{WORK_STATES.map((state) => {
					const on = filter.states.includes(state);
					const count = counts.states[state];
					const color = workStateColorVar({ state, cause: "pinned" });
					return (
						<Tooltip key={state} delayDuration={400}>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-pressed={on}
									onClick={(event) => onStateClick(state, event)}
									className={cn(
										"flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
										on
											? "border-transparent font-medium text-foreground"
											: "border-border text-muted-foreground hover:text-foreground",
										count === 0 && !on && "opacity-50",
									)}
									style={
										on
											? {
													backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
													borderColor: `color-mix(in oklab, ${color} 55%, transparent)`,
												}
											: undefined
									}
								>
									<WorkStateIcon state={state} className="size-3.5" />
									{words.short[state]}
									<span className="tabular-nums opacity-70">{count}</span>
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-60">
								<p className="font-medium">{words.label[state]}</p>
								<p className="opacity-80">{words.hint[state]}</p>
								<p className="mt-1 opacity-60">
									<Trans>⌥-click to show only this state</Trans>
								</p>
							</TooltipContent>
						</Tooltip>
					);
				})}
			</fieldset>
			<span aria-hidden className="h-4 w-px bg-border" />
			<FilterMenu
				label={projectSummary}
				active={filter.projects.length > 0}
				icon={<LuFolderKanban className="size-3.5" />}
			>
				<DropdownMenuLabel className="text-xs">
					<Trans>Projects (from the Pull Requests page)</Trans>
				</DropdownMenuLabel>
				{[
					...projects,
					{ id: OTHER_PROJECT_ID, name: t`No project`, status: null },
				].map((project) => (
					<DropdownMenuCheckboxItem
						key={project.id}
						checked={filter.projects.includes(project.id)}
						onCheckedChange={() => filter.toggleProject(project.id)}
						onSelect={(event) => event.preventDefault()}
						className="text-xs"
					>
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							{project.status && (
								<span
									aria-hidden
									className="size-1.5 shrink-0 rounded-full"
									style={{
										backgroundColor: PROJECT_STATUS_COLOR[project.status],
									}}
								/>
							)}
							<span className="truncate">{project.name}</span>
						</span>
						<span className="ml-3 tabular-nums text-muted-foreground">
							{counts.projects.get(project.id) ?? 0}
						</span>
					</DropdownMenuCheckboxItem>
				))}
			</FilterMenu>
			<FilterMenu
				label={statusSummary}
				active={filter.projectStatuses.length > 0}
				icon={
					<span
						aria-hidden
						className="size-2 rounded-full border border-current opacity-70"
					/>
				}
			>
				<DropdownMenuLabel className="text-xs">
					<Trans>Project status, as in Notion</Trans>
				</DropdownMenuLabel>
				{[...PROJECT_STATUSES, NO_STATUS].map((status) => (
					<DropdownMenuCheckboxItem
						key={status}
						checked={filter.projectStatuses.includes(status)}
						onCheckedChange={() => filter.toggleProjectStatus(status)}
						onSelect={(event) => event.preventDefault()}
						className="text-xs"
					>
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							<span
								aria-hidden
								className="size-1.5 shrink-0 rounded-full"
								style={{
									backgroundColor:
										status === NO_STATUS
											? "transparent"
											: PROJECT_STATUS_COLOR[status as ProjectStatus],
								}}
							/>
							{statusLabels[status as ProjectStatus | "none"]}
						</span>
						<span className="ml-3 tabular-nums text-muted-foreground">
							{counts.projectStatuses.get(status) ?? 0}
						</span>
					</DropdownMenuCheckboxItem>
				))}
			</FilterMenu>
			<WorkspaceFocusFilterChip size="md" />
			{filtering && (
				<button
					type="button"
					onClick={filter.clear}
					className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					<LuX className="size-3" />
					<Trans>Clear</Trans>
				</button>
			)}
			<div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
				<Trans>Rooms</Trans>
				<ToggleGroup
					type="single"
					size="sm"
					value={filter.rooms}
					onValueChange={(value) => {
						if (value) filter.setRooms(value as OfficeRooms);
					}}
					aria-label={t`What rooms stand for`}
					className="rounded-md bg-muted/50 p-0.5"
				>
					<ToggleGroupItem
						value="folders"
						className="h-6 px-2.5 text-xs text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
					>
						<Trans>Folders</Trans>
					</ToggleGroupItem>
					<ToggleGroupItem
						value="projects"
						className="h-6 px-2.5 text-xs text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
					>
						<Trans>Projects</Trans>
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
		</div>
	);
}

function FilterMenu({
	label,
	active,
	icon,
	children,
}: {
	label: string;
	active: boolean;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex h-7 max-w-56 items-center gap-1.5 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						active
							? "border-foreground/30 bg-accent text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
					)}
				>
					{icon}
					<span className="truncate">{label}</span>
					<LuChevronDown className="size-3 shrink-0 opacity-60" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-60">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

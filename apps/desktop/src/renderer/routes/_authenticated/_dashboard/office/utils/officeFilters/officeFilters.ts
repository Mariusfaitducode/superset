import { WORK_STATES, type WorkState } from "renderer/lib/agent-state";

/** No project status set on the project, or no project at all. */
export const NO_STATUS = "none";

export interface OfficeFilter {
	/** Empty keeps every state. */
	states: readonly WorkState[];
	/** Project ids (the "other" id for none); empty keeps every project. */
	projects: readonly string[];
	/** Project statuses, or NO_STATUS; empty keeps every status. */
	projectStatuses: readonly string[];
	focusOnly: boolean;
}

export interface FilterableAgent {
	state: WorkState;
	projectId: string;
	projectStatus: string;
	focused: boolean;
}

type Facet = "states" | "projects" | "projectStatuses";

function passes(
	agent: FilterableAgent,
	filter: OfficeFilter,
	skip?: Facet,
): boolean {
	if (filter.focusOnly && !agent.focused) return false;
	if (
		skip !== "states" &&
		filter.states.length > 0 &&
		!filter.states.includes(agent.state)
	) {
		return false;
	}
	if (
		skip !== "projects" &&
		filter.projects.length > 0 &&
		!filter.projects.includes(agent.projectId)
	) {
		return false;
	}
	if (
		skip !== "projectStatuses" &&
		filter.projectStatuses.length > 0 &&
		!filter.projectStatuses.includes(agent.projectStatus)
	) {
		return false;
	}
	return true;
}

/** Agents are filtered one by one; a desk shows when one of its agents passes. */
export function matchesOfficeFilter(
	agent: FilterableAgent,
	filter: OfficeFilter,
): boolean {
	return passes(agent, filter);
}

export interface FacetCounts {
	states: Record<WorkState, number>;
	projects: Map<string, number>;
	projectStatuses: Map<string, number>;
}

/**
 * What each choice would show, given the other filters: a chip's count is
 * the number of agents that clicking it adds.
 */
export function facetCounts(
	agents: readonly FilterableAgent[],
	filter: OfficeFilter,
): FacetCounts {
	const states = Object.fromEntries(
		WORK_STATES.map((state) => [state, 0]),
	) as Record<WorkState, number>;
	const projects = new Map<string, number>();
	const projectStatuses = new Map<string, number>();
	for (const agent of agents) {
		if (passes(agent, filter, "states")) states[agent.state] += 1;
		if (passes(agent, filter, "projects")) {
			projects.set(agent.projectId, (projects.get(agent.projectId) ?? 0) + 1);
		}
		if (passes(agent, filter, "projectStatuses")) {
			projectStatuses.set(
				agent.projectStatus,
				(projectStatuses.get(agent.projectStatus) ?? 0) + 1,
			);
		}
	}
	return { states, projects, projectStatuses };
}

export function isFiltering(filter: OfficeFilter): boolean {
	return (
		filter.states.length > 0 ||
		filter.projects.length > 0 ||
		filter.projectStatuses.length > 0 ||
		filter.focusOnly
	);
}

import { countWorkStates, type WorkState } from "./work-state";

/**
 * The global numbers of the Office strip and of the observer's snapshot,
 * grouped the way the user acts on them. Each group is a set of work
 * states, so a click filters the Office to exactly the agents counted.
 */
export const FLEET_GROUPS = {
	working: ["working"],
	waiting: ["waiting"],
	toResume: ["todos", "resume"],
	toCheck: ["check"],
	toClose: ["done"],
} as const satisfies Record<string, readonly WorkState[]>;
export type FleetGroup = keyof typeof FLEET_GROUPS;

export interface FleetUsage {
	/** Input billed at the full rate, cache writes included. */
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	/** API-list-rate estimate; null when no price is known for the model. */
	costUsd: number | null;
}

export interface FleetAgent {
	state: WorkState;
	hostId: string;
	/** The model of its latest answer, from its transcript; null while unknown. */
	model: string | null;
	/** Subagents run under it, workflow agents excluded. */
	subagents: number;
	workflowAgents: number;
	/** Its session's totals since it started; null when the host cannot tell. */
	usage: FleetUsage | null;
}

export interface FleetCount {
	open: number;
	working: number;
	waiting: number;
}

export interface FleetStats {
	open: number;
	byState: Record<WorkState, number>;
	groups: Record<FleetGroup, number>;
	subagents: number;
	workflowAgents: number;
	/** Open agents running at least one subagent or workflow agent. */
	withChildren: number;
	/** Most open agents first. */
	hosts: (FleetCount & { hostId: string })[];
	/** Per `modelLabel`, most open agents first; unknown models left out. */
	models: (FleetCount & { model: string })[];
	unknownModel: number;
	/** Summed over the open agents whose session totals are known. */
	usage: FleetUsage & { agents: number; unpriced: number };
}

const FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;

function title(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A short, stable name for a model id: `claude-opus-4-1-20250805` and
 * `claude-opus-4-1` are both "Opus 4.1", `claude-3-5-sonnet-20241022` is
 * "Sonnet 3.5". Any other id is kept as is, without a context suffix.
 */
export function modelLabel(model: string): string {
	const id = model
		.trim()
		.replace(/\[[^\]]*\]$/, "")
		.toLowerCase();
	const family = FAMILIES.join("|");
	const modern = id.match(
		new RegExp(`(?:^|-)(${family})-(\\d{1,2})(?:-(\\d{1,2}))?(?:-\\d{8})?$`),
	);
	if (modern?.[1] && modern[2]) {
		const version = modern[3] ? `${modern[2]}.${modern[3]}` : modern[2];
		return `${title(modern[1])} ${version}`;
	}
	const legacy = id.match(
		new RegExp(`^claude-(\\d+)(?:-(\\d))?-(${family})(?:-\\d{8})?$`),
	);
	if (legacy?.[1] && legacy[3]) {
		const version = legacy[2] ? `${legacy[1]}.${legacy[2]}` : legacy[1];
		return `${title(legacy[3])} ${version}`;
	}
	const bare = id.match(new RegExp(`^(${family})$`));
	if (bare?.[1]) return title(bare[1]);
	return model.trim().replace(/\[[^\]]*\]$/, "");
}

function bump(map: Map<string, FleetCount>, key: string, state: WorkState) {
	const count = map.get(key) ?? { open: 0, working: 0, waiting: 0 };
	count.open += 1;
	if (state === "working") count.working += 1;
	if (state === "waiting") count.waiting += 1;
	map.set(key, count);
}

function sorted<K extends string>(
	map: Map<string, FleetCount>,
	key: K,
): (FleetCount & Record<K, string>)[] {
	return [...map.entries()]
		.map(
			([id, count]) =>
				({ ...count, [key]: id }) as FleetCount & Record<K, string>,
		)
		.sort((a, b) => b.open - a.open || a[key].localeCompare(b[key]));
}

export function fleetGroupOf(state: WorkState): FleetGroup {
	for (const [group, states] of Object.entries(FLEET_GROUPS)) {
		if ((states as readonly WorkState[]).includes(state)) {
			return group as FleetGroup;
		}
	}
	throw new Error(`No fleet group for ${state}`);
}

/** One pass over the open agents, each counted once in its work state. */
export function summarizeFleet(agents: readonly FleetAgent[]): FleetStats {
	const byState = countWorkStates(agents.map((agent) => agent.state));
	const groups = Object.fromEntries(
		Object.entries(FLEET_GROUPS).map(([group, states]) => [
			group,
			states.reduce((sum, state) => sum + byState[state], 0),
		]),
	) as Record<FleetGroup, number>;
	const hosts = new Map<string, FleetCount>();
	const models = new Map<string, FleetCount>();
	let unknownModel = 0;
	let subagents = 0;
	let workflowAgents = 0;
	let withChildren = 0;
	const usage = {
		inputTokens: 0,
		cachedInputTokens: 0,
		outputTokens: 0,
		costUsd: null as number | null,
		agents: 0,
		unpriced: 0,
	};
	for (const agent of agents) {
		bump(hosts, agent.hostId, agent.state);
		if (agent.model) bump(models, modelLabel(agent.model), agent.state);
		else unknownModel += 1;
		subagents += agent.subagents;
		workflowAgents += agent.workflowAgents;
		if (agent.subagents + agent.workflowAgents > 0) withChildren += 1;
		if (agent.usage) {
			usage.agents += 1;
			usage.inputTokens += agent.usage.inputTokens;
			usage.cachedInputTokens += agent.usage.cachedInputTokens;
			usage.outputTokens += agent.usage.outputTokens;
			if (agent.usage.costUsd === null) usage.unpriced += 1;
			else usage.costUsd = (usage.costUsd ?? 0) + agent.usage.costUsd;
		}
	}
	return {
		open: agents.length,
		byState,
		groups,
		subagents,
		workflowAgents,
		withChildren,
		hosts: sorted(hosts, "hostId"),
		models: sorted(models, "model"),
		unknownModel,
		usage,
	};
}

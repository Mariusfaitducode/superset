import {
	type FleetAgent,
	type FleetStats,
	modelLabel,
	summarizeFleet,
} from "@superset/shared/agent-fleet-stats";
import {
	type AgentRunState,
	agentRunState,
} from "@superset/shared/agent-status";
import {
	countLiveChildren,
	deriveConversationState,
	deriveWorkState,
	type PinnableWorkState,
	type WorkState,
	type WorkStateCause,
	type WorkStateReport,
} from "@superset/shared/work-state";

interface WorkspaceRow {
	id: string;
	name: string;
	branch?: string | null;
	projectName?: string | null;
}

interface TerminalRow {
	terminalId: string;
	workspaceId: string;
	title: string | null;
}

interface AgentRow {
	terminalId: string;
	workspaceId: string;
	agentId: string;
	lastEventType: string;
	lastEventAt: number;
	startedAt: number;
	endedAt?: number | null;
	subagents?: { lastEventAt?: number; workflow?: unknown }[];
	backgroundTasks?: { kind: string }[];
}

interface TodoRow {
	workspaceId: string;
	terminalId: string;
	text: string;
	done: boolean;
	author: string;
	priority: string;
	kind: string;
	dueOn: string | null;
}

interface ReportRow {
	workspaceId: string;
	terminalId: string;
	kind: string;
	summary: string;
	status: string;
	createdAt: number;
}

interface NoteRow {
	workspaceId: string;
	text: string;
	details: string | null;
	kind: string;
	status: string;
	createdBy: string;
	createdAt: number;
}

interface TaskRow {
	workspaceId: string;
	terminalId: string;
	liveTerminalId?: string;
	title: string;
	status: string;
	silence?: string | null;
	updatedAt: number;
	link: string | null;
}

interface MarkRow {
	terminalId: string;
	state: PinnableWorkState;
	setBy: "user" | "agent";
	setAt: number;
}

interface SessionStatsRow {
	terminalId: string;
	stats: {
		model: string | null;
		inputTokens: number;
		cachedInputTokens: number;
		outputTokens: number;
		costUsd: number | null;
	} | null;
}

interface LabelsRow {
	labels: { id: string; name: string }[];
	assignments: Record<string, string[]>;
}

export interface DigestInput {
	now: number;
	workspaces: WorkspaceRow[];
	terminals: TerminalRow[];
	agents: AgentRow[];
	todos: TodoRow[] | null;
	/** Every status: a DONE the user acknowledged still says "done". */
	reports: ReportRow[] | null;
	/** States pinned on conversations; null on hosts too old to keep them. */
	marks: MarkRow[] | null;
	/** Models and tokens of live agents; null on hosts too old to give them. */
	sessionStats: SessionStatsRow[] | null;
	/** The host read, for the per-host count. */
	hostId: string;
	notes: NoteRow[] | null;
	tasks: TaskRow[] | null;
	labels: LabelsRow | null;
	/** Sources this host could not give, so the reader knows what is missing. */
	unavailable: string[];
	/** Workspaces of the observer's own runs, left out of the digest. */
	ignoreWorkspaceIds?: ReadonlySet<string>;
}

/**
 * The Office's work state, from the same derivation and sources (lifecycle,
 * reports, to-dos, pins). The one thing the CLI cannot see is whether the
 * user has read an agent's last reply: that stays in the app. A stopped
 * agent is taken as read, and `ifUnread` gives what the Office shows instead
 * while the reply is unread there.
 */
export interface DigestWork {
	state: WorkState;
	cause: WorkStateCause;
	pinned: boolean;
	ifUnread: WorkState | null;
}

export interface DigestConversation {
	terminalId: string;
	title: string | null;
	agent: string | null;
	/** Hook-level run state; `work` is what the Office shows. */
	state: AgentRunState | "no-agent";
	work: DigestWork | null;
	/** `modelLabel` of its latest answer; null when unknown. */
	model: string | null;
	/** Minutes since the agent's last hook event. */
	quietMinutes: number | null;
	ageHours: number | null;
	subagents: number;
	openTodos: {
		text: string;
		by: string;
		priority: string;
		kind: string;
		due: string | null;
	}[];
	openReports: { kind: string; summary: string; ageHours: number }[];
	tracked: {
		title: string;
		status: string;
		silence: string | null;
		link: string | null;
	}[];
}

export interface DigestWorkspace {
	id: string;
	name: string;
	project: string | null;
	branch: string | null;
	labels: string[];
	conversations: DigestConversation[];
	notes: { text: string; kind: string; status: string; by: string }[];
}

export interface DigestFleet extends FleetStats {
	/** Stopped agents taken as read; any of them may be "waiting" in the app. */
	readUnknown: number;
	/** Whether models and tokens could be read on this host. */
	modelsAvailable: boolean;
}

export interface Digest {
	generatedAt: string;
	/**
	 * The Office's global numbers for every live agent of the host, the
	 * observer's own sessions included, as the Office counts them.
	 */
	fleet: DigestFleet;
	totals: {
		workspaces: number;
		conversations: number;
		working: number;
		blocked: number;
		idle: number;
		/** Idle for more than a day: candidates to close. */
		idleOverADay: number;
		openReports: number;
		openUserTodos: number;
	};
	/** "Superset idea:" notes from every workspace. */
	supersetIdeas: { workspace: string; text: string; details: string | null }[];
	workspaces: DigestWorkspace[];
	unavailable: string[];
}

const SUPERSET_IDEA = /^superset idea\s*:/i;

interface WorkSources {
	now: number;
	openTodos: readonly TodoRow[];
	reports: readonly ReportRow[];
	marks: ReadonlyMap<string, MarkRow>;
}

const REPORT_KINDS = new Set([
	"done",
	"decision",
	"draft",
	"blocked",
	"progress",
]);
const REPORT_STATUSES = new Set(["open", "answered", "dismissed"]);

function asWorkReport(report: ReportRow): WorkStateReport | null {
	if (!REPORT_KINDS.has(report.kind) || !REPORT_STATUSES.has(report.status)) {
		return null;
	}
	return report as unknown as WorkStateReport;
}

function workSources(input: DigestInput): WorkSources {
	return {
		now: input.now,
		openTodos: (input.todos ?? []).filter((todo) => !todo.done),
		reports: input.reports ?? [],
		marks: new Map((input.marks ?? []).map((mark) => [mark.terminalId, mark])),
	};
}

function sessionStatsByTerminal(input: DigestInput) {
	return new Map(
		(input.sessionStats ?? []).map((row) => [row.terminalId, row.stats]),
	);
}

export interface FleetMember extends FleetAgent {
	readUnknown: boolean;
}

/** Every live agent of the host, as the Office strip counts it. */
export function fleetMembers(input: DigestInput): FleetMember[] {
	const sources = workSources(input);
	const statsByTerminal = sessionStatsByTerminal(input);
	return input.agents
		.filter((agent) => agent.endedAt == null)
		.map((agent) => {
			const work = digestWork(agent, sources);
			const stats = statsByTerminal.get(agent.terminalId) ?? null;
			const workflowAgents =
				agent.subagents?.filter((subagent) => subagent.workflow).length ?? 0;
			return {
				state: work.state,
				hostId: input.hostId,
				model: stats?.model ?? null,
				subagents: (agent.subagents?.length ?? 0) - workflowAgents,
				workflowAgents,
				usage: stats
					? {
							inputTokens: stats.inputTokens,
							cachedInputTokens: stats.cachedInputTokens,
							outputTokens: stats.outputTokens,
							costUsd: stats.costUsd,
						}
					: null,
				readUnknown: work.ifUnread !== null,
			};
		});
}

/** One fleet over one or several hosts' members. */
export function summarizeHosts(
	hosts: readonly { members: FleetMember[]; modelsAvailable: boolean }[],
): DigestFleet {
	const members = hosts.flatMap((host) => host.members);
	return {
		...summarizeFleet(members),
		readUnknown: members.filter((member) => member.readUnknown).length,
		modelsAvailable: hosts.some((host) => host.modelsAvailable),
	};
}

/** `deriveWorkState` as the Office runs it, read and unread. */
export function digestWork(agent: AgentRow, sources: WorkSources): DigestWork {
	const liveChildren = countLiveChildren(agent);
	const mark = sources.marks.get(agent.terminalId);
	const base = {
		since: agent.lastEventAt,
		openTodos: sources.openTodos.filter(
			(todo) => todo.terminalId === agent.terminalId,
		).length,
		reports: sources.reports
			.filter((report) => report.terminalId === agent.terminalId)
			.map(asWorkReport)
			.filter((report): report is WorkStateReport => report !== null),
		mark: mark
			? { state: mark.state, setBy: mark.setBy, setAt: mark.setAt }
			: null,
		hasChildren: (agent.subagents?.length ?? 0) > 0,
		now: sources.now,
	};
	const conversation = (lastSeenAt: number | undefined) =>
		deriveConversationState({
			lastEventType: agent.lastEventType,
			lastEventAt: agent.lastEventAt,
			lastSeenAt,
			liveChildren,
		});
	const read = deriveWorkState({
		...base,
		conversation: conversation(agent.lastEventAt),
	});
	const unread = deriveWorkState({
		...base,
		conversation: conversation(undefined),
	});
	return {
		state: read.state,
		cause: read.cause,
		pinned: read.mark !== null,
		ifUnread: unread.state === read.state ? null : unread.state,
	};
}
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * One compact read of every agent on a host for the Office observer: who
 * runs where, in what state, since when, and what each one still owes or
 * waits for. Workspaces without a conversation, a report, a to-do or a note
 * are left out: they say nothing.
 */
export function buildDigest(input: DigestInput): Digest {
	const ignored = input.ignoreWorkspaceIds ?? new Set<string>();
	const live = input.agents.filter((agent) => agent.endedAt == null);
	const agentByTerminal = new Map(
		live.map((agent) => [agent.terminalId, agent]),
	);
	const labelNames = new Map(
		(input.labels?.labels ?? []).map((label) => [label.id, label.name]),
	);
	const openTodos = (input.todos ?? []).filter((todo) => !todo.done);
	const openReports = (input.reports ?? []).filter(
		(report) => report.status === "open",
	);
	const openNotes = (input.notes ?? []).filter(
		(note) => note.status === "open" || note.status === "kept",
	);
	const runningTasks = (input.tasks ?? []).filter(
		(task) => task.status === "running",
	);
	const sources = workSources(input);
	const statsByTerminal = sessionStatsByTerminal(input);
	const modelOf = (terminalId: string) => {
		const model = statsByTerminal.get(terminalId)?.model;
		return model ? modelLabel(model) : null;
	};

	const workspaces: DigestWorkspace[] = [];
	for (const workspace of input.workspaces) {
		if (ignored.has(workspace.id)) continue;
		// Plain shells say nothing: a terminal counts once an agent, a to-do,
		// a report or a tracked task is attached to it.
		const terminalIds = new Set<string>();
		for (const agent of live) {
			if (agent.workspaceId === workspace.id) terminalIds.add(agent.terminalId);
		}
		for (const row of [...openTodos, ...openReports]) {
			if (row.workspaceId === workspace.id) terminalIds.add(row.terminalId);
		}
		for (const task of runningTasks) {
			if (task.workspaceId === workspace.id)
				terminalIds.add(task.liveTerminalId ?? task.terminalId);
		}
		const conversations = [...terminalIds].map((terminalId) => {
			const agent = agentByTerminal.get(terminalId);
			const terminal = input.terminals.find(
				(row) => row.terminalId === terminalId,
			);
			return {
				terminalId,
				title: terminal?.title ?? null,
				agent: agent?.agentId ?? null,
				state: agent ? agentRunState(agent.lastEventType) : "no-agent",
				work: agent ? digestWork(agent, sources) : null,
				model: agent ? modelOf(terminalId) : null,
				quietMinutes: agent
					? Math.max(0, Math.round((input.now - agent.lastEventAt) / MINUTE))
					: null,
				ageHours: agent
					? Math.round((input.now - agent.startedAt) / HOUR)
					: null,
				subagents: agent?.subagents?.length ?? 0,
				openTodos: openTodos
					.filter((todo) => todo.terminalId === terminalId)
					.map((todo) => ({
						text: todo.text,
						by: todo.author,
						priority: todo.priority,
						kind: todo.kind,
						due: todo.dueOn,
					})),
				openReports: openReports
					.filter((report) => report.terminalId === terminalId)
					.map((report) => ({
						kind: report.kind,
						summary: report.summary,
						ageHours: Math.round((input.now - report.createdAt) / HOUR),
					})),
				tracked: runningTasks
					.filter(
						(task) => (task.liveTerminalId ?? task.terminalId) === terminalId,
					)
					.map((task) => ({
						title: task.title,
						status: task.status,
						silence: task.silence ?? null,
						link: task.link,
					})),
			} satisfies DigestConversation;
		});
		const notes = openNotes
			.filter((note) => note.workspaceId === workspace.id)
			.filter((note) => !SUPERSET_IDEA.test(note.text))
			.map((note) => ({
				text: note.text,
				kind: note.kind,
				status: note.status,
				by: note.createdBy,
			}));
		if (conversations.length === 0 && notes.length === 0) continue;
		workspaces.push({
			id: workspace.id,
			name: workspace.name,
			project: workspace.projectName ?? null,
			branch: workspace.branch ?? null,
			labels: (input.labels?.assignments[workspace.id] ?? [])
				.map((id) => labelNames.get(id))
				.filter((name): name is string => Boolean(name)),
			conversations,
			notes,
		});
	}

	const conversations = workspaces.flatMap(
		(workspace) => workspace.conversations,
	);
	const count = (state: DigestConversation["state"]) =>
		conversations.filter((conversation) => conversation.state === state).length;
	const workspaceName = new Map(
		input.workspaces.map((workspace) => [workspace.id, workspace.name]),
	);

	return {
		generatedAt: new Date(input.now).toISOString(),
		fleet: summarizeHosts([
			{
				members: fleetMembers(input),
				modelsAvailable: input.sessionStats !== null,
			},
		]),
		totals: {
			workspaces: workspaces.length,
			conversations: conversations.length,
			working: count("working"),
			blocked: count("blocked"),
			idle: count("idle"),
			idleOverADay: conversations.filter(
				(conversation) =>
					conversation.state === "idle" &&
					(conversation.quietMinutes ?? 0) > 24 * 60,
			).length,
			openReports: conversations.reduce(
				(sum, conversation) => sum + conversation.openReports.length,
				0,
			),
			openUserTodos: conversations.reduce(
				(sum, conversation) =>
					sum +
					conversation.openTodos.filter((todo) => todo.by === "user").length,
				0,
			),
		},
		supersetIdeas: openNotes
			.filter((note) => SUPERSET_IDEA.test(note.text))
			.map((note) => ({
				workspace: workspaceName.get(note.workspaceId) ?? note.workspaceId,
				text: note.text,
				details: note.details,
			})),
		workspaces,
		unavailable: input.unavailable,
	};
}

/** The digest for a person at a shell; agents read the JSON. */
export function formatDigest(digest: Digest): string {
	const { totals } = digest;
	const lines = [
		...formatFleet(digest.fleet),
		`${totals.conversations} conversations in ${totals.workspaces} workspaces. ${totals.openReports} open reports, ${totals.openUserTodos} open user to-dos.`,
	];
	for (const workspace of digest.workspaces) {
		const where = [workspace.project, workspace.name]
			.filter(Boolean)
			.join(" / ");
		const labels = workspace.labels.length
			? ` [${workspace.labels.join(", ")}]`
			: "";
		lines.push("", `${where}${labels}`);
		for (const conversation of workspace.conversations) {
			const quiet =
				conversation.quietMinutes === null
					? ""
					: ` · quiet ${conversation.quietMinutes} min`;
			const model = conversation.model ? ` · ${conversation.model}` : "";
			lines.push(
				`  ${describeState(conversation)}${quiet}${model} · ${conversation.title ?? conversation.terminalId}`,
			);
			for (const report of conversation.openReports) {
				lines.push(`    report ${report.kind}: ${report.summary}`);
			}
			for (const todo of conversation.openTodos) {
				lines.push(`    to-do (${todo.by}): ${todo.text}`);
			}
		}
	}
	if (digest.supersetIdeas.length > 0) {
		lines.push("", "Superset ideas:");
		for (const idea of digest.supersetIdeas) lines.push(`  ${idea.text}`);
	}
	if (digest.unavailable.length > 0) {
		lines.push(
			"",
			`Not available on this host: ${digest.unavailable.join(", ")}`,
		);
	}
	return lines.join("\n");
}

function describeState(conversation: DigestConversation): string {
	const { work } = conversation;
	if (!work) return conversation.state;
	const pinned = work.pinned ? " (pinned)" : "";
	const unread = work.ifUnread ? ` (${work.ifUnread} if unread)` : "";
	return `${work.state}${pinned}${unread}`;
}

/** The Office strip's numbers, for a person at a shell. */
export function formatFleet(fleet: DigestFleet): string[] {
	const { groups } = fleet;
	const lines = [
		`${fleet.open} open agents: ${groups.working} working, ${groups.waiting} waiting for you, ${groups.toResume} to resume (${fleet.byState.todos} with to-dos, ${fleet.byState.resume} later), ${groups.toCheck} to check, ${groups.toClose} to close. ${fleet.subagents} subagents and ${fleet.workflowAgents} workflow agents under ${fleet.withChildren} of them.`,
	];
	if (fleet.readUnknown > 0) {
		lines.push(
			`${fleet.readUnknown} stopped agents are counted as read; the app shows any whose last reply is unread as waiting for you.`,
		);
	}
	if (!fleet.modelsAvailable) {
		lines.push("Models and tokens: unavailable on this host.");
		return lines;
	}
	const models = fleet.models.map((model) => `${model.model} ${model.open}`);
	if (fleet.unknownModel > 0) models.push(`unknown ${fleet.unknownModel}`);
	const tokens =
		fleet.usage.inputTokens +
		fleet.usage.cachedInputTokens +
		fleet.usage.outputTokens;
	const cost =
		fleet.usage.costUsd === null
			? ""
			: `, about $${fleet.usage.costUsd.toFixed(2)} at API list rates`;
	lines.push(
		`Models: ${models.join(", ") || "none"}. Tokens since they started: ${tokens} for ${fleet.usage.agents} agents${cost}.`,
	);
	return lines;
}

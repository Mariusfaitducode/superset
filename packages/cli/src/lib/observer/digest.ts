import {
	type AgentRunState,
	agentRunState,
} from "@superset/shared/agent-status";

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
	subagents?: unknown[];
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
	reports: ReportRow[] | null;
	notes: NoteRow[] | null;
	tasks: TaskRow[] | null;
	labels: LabelsRow | null;
	/** Sources this host could not give, so the reader knows what is missing. */
	unavailable: string[];
	/** Workspaces of the observer's own runs, left out of the digest. */
	ignoreWorkspaceIds?: ReadonlySet<string>;
}

export interface DigestConversation {
	terminalId: string;
	title: string | null;
	agent: string | null;
	state: AgentRunState | "no-agent";
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

export interface Digest {
	generatedAt: string;
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
		`${totals.conversations} conversations in ${totals.workspaces} workspaces: ${totals.working} working, ${totals.blocked} blocked, ${totals.idle} idle (${totals.idleOverADay} for over a day). ${totals.openReports} open reports, ${totals.openUserTodos} open user to-dos.`,
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
			lines.push(
				`  ${conversation.state}${quiet} · ${conversation.title ?? conversation.terminalId}`,
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

import { boolean, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	buildDigest,
	formatDigest,
	isMissingProcedure,
} from "../../../lib/observer";
import { resolveHostClient } from "../../../lib/resolve-host-client";

export default command({
	description:
		"One compact read of every agent on a host for the observer: state, quiet time, open to-dos, reports, tracked tasks, labels, notes and Superset ideas",
	options: {
		host: string().desc("Host to read (default: this machine)"),
		insights: boolean().desc(
			"Add the last days of Insights (how the user drove the agents). Slow on a first scan",
		),
	},
	run: async ({ ctx, options }) => {
		const client = await resolveHostClient(ctx, options);
		const unavailable: string[] = [];
		// A host older than a fork store still gives the rest; the digest
		// lists what it could not read instead of showing it as empty.
		const optional = async <T>(
			name: string,
			read: () => Promise<T>,
		): Promise<T | null> => {
			try {
				return await read();
			} catch (error) {
				if (!isMissingProcedure(error)) throw error;
				unavailable.push(name);
				return null;
			}
		};
		const [workspaces, { sessions }, agents, todos, reports, notes, tasks] =
			await Promise.all([
				client.workspace.list.query(),
				client.terminal.list.query(),
				client.terminalAgents.list.query(),
				optional("todos", () => client.conversationTodos.list.query({})),
				optional("reports", () =>
					client.agentReports.list.query({ status: "open" }),
				),
				optional("notes", () => client.workspaceNotes.list.query({})),
				optional("tracked tasks", () => client.trackedTasks.list.query({})),
			]);
		const [labels, observer] = await Promise.all([
			optional("labels", () => client.workspaceLabels.list.query()),
			optional("observer runs", () =>
				client.officeObserver.get.query({ limit: 20 }),
			),
		]);
		const insights = options.insights
			? await optional("insights", () =>
					client.insights.summary.query({
						days: 7,
						timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					}),
				)
			: null;
		const digest = buildDigest({
			now: Date.now(),
			workspaces,
			terminals: sessions,
			agents,
			todos,
			reports,
			notes,
			tasks,
			labels,
			unavailable,
			ignoreWorkspaceIds: new Set(
				(observer?.runs ?? []).map((run) => run.workspaceId),
			),
		});
		const data = {
			...digest,
			insights: insights
				? {
						complete: insights.complete,
						days: insights.days.slice(-3),
						lastWeek: insights.weeks.at(-1) ?? null,
						desk: insights.desk,
					}
				: null,
		};
		return { data, message: formatDigest(digest) };
	},
});

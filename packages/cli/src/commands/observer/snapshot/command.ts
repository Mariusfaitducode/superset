import { boolean, string } from "@superset/cli-framework";
import { getHostId } from "@superset/shared/host-info";
import { command } from "../../../lib/command";
import {
	buildDigest,
	type DigestInput,
	fleetMembers,
	formatDigest,
	formatFleet,
	isMissingProcedure,
	summarizeHosts,
} from "../../../lib/observer";
import { resolveHostClient } from "../../../lib/resolve-host-client";

type HostClient = Awaited<ReturnType<typeof resolveHostClient>>;

/** Everything the digest reads from one host. */
async function readHost(
	client: HostClient,
	hostId: string,
): Promise<DigestInput> {
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
	const [
		workspaces,
		{ sessions },
		agents,
		todos,
		reports,
		notes,
		tasks,
		marks,
		sessionStats,
		labels,
		observer,
	] = await Promise.all([
		client.workspace.list.query(),
		client.terminal.list.query(),
		client.terminalAgents.list.query(),
		optional("todos", () => client.conversationTodos.list.query({})),
		// Every status: an acknowledged DONE still makes a conversation "done".
		optional("reports", () => client.agentReports.list.query({})),
		optional("notes", () => client.workspaceNotes.list.query({})),
		optional("tracked tasks", () => client.trackedTasks.list.query({})),
		optional("pinned states", () => client.conversationStates.list.query({})),
		optional("models and tokens", () =>
			client.terminalAgents.liveSessionStats.query(),
		),
		optional("labels", () => client.workspaceLabels.list.query()),
		optional("observer runs", () =>
			client.officeObserver.get.query({ limit: 20 }),
		),
	]);
	return {
		now: Date.now(),
		hostId,
		workspaces,
		terminals: sessions,
		agents,
		todos,
		reports,
		marks,
		sessionStats,
		notes,
		tasks,
		labels,
		unavailable,
		ignoreWorkspaceIds: new Set(
			(observer?.runs ?? []).map((run) => run.workspaceId),
		),
	};
}

export default command({
	description:
		"One compact read of every agent on a host for the observer: the Office's work states and global numbers (working, waiting, to resume, to check, to close, subagents, models, tokens), quiet time, open to-dos, reports, tracked tasks, labels, notes and Superset ideas",
	options: {
		host: string().desc("Host to read (default: this machine)"),
		allHosts: boolean().desc(
			"Also read every other online host, with the global numbers across all of them",
		),
		insights: boolean().desc(
			"Add the last days of Insights (how the user drove the agents). Slow on a first scan",
		),
	},
	run: async ({ ctx, options }) => {
		const hostId = options.host ?? getHostId();
		const client = await resolveHostClient(ctx, { host: hostId });
		const input = await readHost(client, hostId);
		let insights: Awaited<
			ReturnType<HostClient["insights"]["summary"]["query"]>
		> | null = null;
		if (options.insights) {
			try {
				insights = await client.insights.summary.query({
					days: 7,
					timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				});
			} catch (error) {
				if (!isMissingProcedure(error)) throw error;
				input.unavailable.push("insights");
			}
		}
		const digest = buildDigest(input);
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
		if (!options.allHosts) {
			return { data, message: formatDigest(digest) };
		}

		const organizationId = ctx.config.organizationId;
		const rows = organizationId
			? await ctx.api.host.list.query({ organizationId })
			: [];
		const names = new Map(rows.map((row) => [row.id, row.name]));
		const others = await Promise.all(
			rows
				.filter((row) => row.id !== hostId && row.online)
				.map(async (row) => {
					try {
						const other = await readHost(
							await resolveHostClient(ctx, { host: row.id }),
							row.id,
						);
						return { id: row.id, name: row.name, input: other, error: null };
					} catch (error) {
						const message =
							error instanceof Error ? error.message : String(error);
						return { id: row.id, name: row.name, input: null, error: message };
					}
				}),
		);
		const inputs = [
			input,
			...others.flatMap((other) => (other.input ? [other.input] : [])),
		];
		const fleet = summarizeHosts(
			inputs.map((hostInput) => ({
				members: fleetMembers(hostInput),
				modelsAvailable: hostInput.sessionStats !== null,
			})),
		);
		const digests = [
			{ id: hostId, name: names.get(hostId) ?? null, digest: data },
			...others.flatMap((other) =>
				other.input
					? [
							{
								id: other.id,
								name: other.name,
								digest: buildDigest(other.input),
							},
						]
					: [],
			),
		];
		const unreachable = others
			.filter((other) => other.error !== null)
			.map(({ id, name, error }) => ({ id, name, error }));

		const lines = [
			"All hosts:",
			...formatFleet(fleet),
			`Per host: ${fleet.hosts
				.map((host) => `${names.get(host.hostId) ?? host.hostId} ${host.open}`)
				.join(", ")}.`,
		];
		if (unreachable.length > 0) {
			lines.push(
				`Could not read: ${unreachable.map((host) => host.name).join(", ")}.`,
			);
		}
		for (const entry of digests) {
			lines.push("", `${entry.name ?? entry.id}:`, formatDigest(entry.digest));
		}
		return {
			data: {
				fleet: {
					...fleet,
					hosts: fleet.hosts.map((host) => ({
						...host,
						name: names.get(host.hostId) ?? null,
					})),
				},
				hosts: digests,
				unreachable,
			},
			message: lines.join("\n"),
		};
	},
});

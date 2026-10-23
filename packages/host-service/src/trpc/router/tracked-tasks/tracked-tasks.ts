import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	checkTrackedTaskCiNow,
	findTaskAgent,
	getTrackedTaskStore,
	parseGithubCiLink,
	silenceOf,
	type TrackedTaskCaller,
	type TrackedTaskCi,
	TrackedTaskNotFoundError,
	TrackedTaskPermissionError,
} from "../../../tracked-tasks";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

const getStore = getTrackedTaskStore;

function run<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof TrackedTaskPermissionError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		if (error instanceof TrackedTaskNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: error.message });
		}
		if (error instanceof Error) {
			throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
		}
		throw error;
	}
}

/** Runs a change and tells every client, so none has to poll for it. */
function change<T>(ctx: HostServiceContext, action: () => T): T {
	const result = run(action);
	ctx.eventBus.broadcastHostStoreChanged("tracked-tasks");
	return result;
}

/** An agent is known by its terminal, and by its conversation once resumed. */
function agentCaller(
	ctx: HostServiceContext,
	terminalId: string,
): TrackedTaskCaller {
	return {
		actor: "agent",
		terminalId,
		conversationId:
			ctx.terminalAgentStore.get(terminalId)?.agentSessionId ?? null,
	};
}

/** For what only the user may do: any agent is refused, whichever it is. */
function actorCaller(actor: "user" | "agent"): TrackedTaskCaller {
	return actor === "user"
		? { actor: "user" }
		: { actor: "agent", terminalId: "", conversationId: null };
}

/** The task named, or the caller's latest running one. */
function taskId(caller: TrackedTaskCaller, id: string | undefined): string {
	return id ?? getStore().latestRunning(caller).id;
}

function ciFor(
	link: string | null | undefined,
	workflow: string | null | undefined,
): TrackedTaskCi | null {
	const target = link ? parseGithubCiLink(link, workflow ?? null) : null;
	if (!target) return null;
	return {
		...target,
		jobsTotal: 0,
		jobsDone: 0,
		currentJob: null,
		runUrl: target.runId !== null ? (link ?? null) : null,
		checkedAt: null,
		error: null,
	};
}

const terminalId = z.string().min(1);
const id = z.string().optional();
const note = z.string().trim().max(2_000).optional();
const link = z
	.url({ protocol: /^https?$/ })
	.max(2_000)
	.nullable();
// The app acts as the user; agents say so through the CLI.
const actor = z.enum(["user", "agent"]).default("user");

/**
 * Long-running work that agents follow with `superset track`, shown as
 * cards in the app's task monitor. Kept in a file under the Superset home,
 * like the conversation to-dos.
 */
export const trackedTasksRouter = router({
	/**
	 * Each running task says whether, and why, it looks abandoned, and which
	 * terminal its conversation runs in now.
	 */
	list: protectedProcedure
		.input(
			z
				.object({
					workspaceId: z.string().optional(),
					terminalId: z.string().optional(),
					archived: z.boolean().optional(),
				})
				.default({}),
		)
		.query(({ ctx, input }) => {
			const now = Date.now();
			const live = ctx.terminalAgentStore.list();
			return getStore()
				.list(input)
				.map((task) => {
					const agent = findTaskAgent(task, live);
					return {
						...task,
						/** Where the conversation runs now, after any resume. */
						liveTerminalId: agent?.terminalId ?? task.terminalId,
						silence: silenceOf(task, agent, now),
					};
				});
		}),

	start: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				terminalId,
				title: z.string().trim().min(1).max(200),
				steps: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
				link: link.optional(),
				workflow: z.string().trim().min(1).max(200).optional(),
				silenceAfterMinutes: z
					.number()
					.int()
					.min(1)
					.max(24 * 60)
					.optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
			const ci = ciFor(input.link, input.workflow);
			const task = change(ctx, () =>
				getStore().start({
					...input,
					conversationId:
						ctx.terminalAgentStore.get(input.terminalId)?.agentSessionId ??
						null,
					ci,
				}),
			);
			if (ci) checkTrackedTaskCiNow();
			return task;
		}),

	step: protectedProcedure
		.input(
			z.object({
				terminalId,
				id,
				step: z.union([z.number().int().min(0), z.string().trim().min(1)]),
				note,
			}),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().step(
					caller,
					taskId(caller, input.id),
					input.step,
					input.note,
				);
			}),
		),

	progress: protectedProcedure
		.input(
			z.object({
				terminalId,
				id,
				percent: z.number().min(0).max(100),
				note,
			}),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().progress(
					caller,
					taskId(caller, input.id),
					input.percent,
					input.note,
				);
			}),
		),

	note: protectedProcedure
		.input(
			z.object({ terminalId, id, text: z.string().trim().min(1).max(2_000) }),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().note(caller, taskId(caller, input.id), input.text);
			}),
		),

	setLink: protectedProcedure
		.input(
			z.object({
				terminalId,
				id,
				link,
				workflow: z.string().trim().min(1).max(200).optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
			const ci = ciFor(input.link, input.workflow);
			const task = change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().setLink(
					caller,
					taskId(caller, input.id),
					input.link,
					ci,
				);
			});
			if (ci) checkTrackedTaskCiNow();
			return task;
		}),

	done: protectedProcedure
		.input(z.object({ terminalId, id, note }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().finish(caller, taskId(caller, input.id), {
					status: "done",
					note: input.note,
				});
			}),
		),

	fail: protectedProcedure
		.input(
			z.object({
				terminalId,
				id,
				reason: z.string().trim().min(1).max(2_000),
			}),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () => {
				const caller = agentCaller(ctx, input.terminalId);
				return getStore().finish(caller, taskId(caller, input.id), {
					status: "failed",
					reason: input.reason,
				});
			}),
		),

	/** Closing a card. Only the user may: agents get FORBIDDEN. */
	archive: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().archive(actorCaller(input.actor), input.id)),
		),

	restore: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().restore(actorCaller(input.actor), input.id)),
		),
});

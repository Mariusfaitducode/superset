import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	AgentReportStore,
	DRAFT_TARGETS,
	REPORT_ACTORS,
	REPORT_KINDS,
	REPORT_STATUSES,
	ReportClosedError,
	ReportNotFoundError,
	ReportPermissionError,
} from "../../../agent-reports";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

let store: AgentReportStore | null = null;

function getStore(): AgentReportStore {
	store ??= new AgentReportStore();
	return store;
}

function run<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof ReportPermissionError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		if (error instanceof ReportNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: error.message });
		}
		if (error instanceof ReportClosedError) {
			throw new TRPCError({ code: "CONFLICT", message: error.message });
		}
		throw error;
	}
}

function change<T>(ctx: HostServiceContext, action: () => T): T {
	const result = run(action);
	ctx.eventBus.broadcastHostStoreChanged("agent-reports");
	return result;
}

// The app acts as the user; agents say so through the CLI.
const actor = z.enum(REPORT_ACTORS).default("user");
const longText = z.string().max(10_000);
const link = z.url({ protocol: /^https?$/ }).max(2_000);

/**
 * What agents hand over to the user, gathered on the Desk. Kept in a file
 * under the Superset home like conversation to-dos, so the fork adds no
 * migration to rebase.
 */
export const agentReportsRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					workspaceId: z.string().optional(),
					terminalId: z.string().optional(),
					status: z.enum(REPORT_STATUSES).optional(),
				})
				.default({}),
		)
		.query(({ input }) => getStore().list(input)),

	create: protectedProcedure
		.input(
			z.object({
				actor,
				workspaceId: z.string().min(1),
				terminalId: z.string().min(1),
				kind: z.enum(REPORT_KINDS),
				summary: z.string().trim().min(1).max(500),
				details: longText.optional(),
				links: z.array(link).max(10).optional(),
				checks: z.string().max(2_000).optional(),
				test: z.string().max(2_000).optional(),
				// The Desk picks options with the number keys 1 to 9.
				options: z.array(z.string().trim().min(1).max(200)).max(9).optional(),
				draft: z
					.object({
						text: z.string().trim().min(1).max(20_000),
						target: z.enum(DRAFT_TARGETS),
					})
					.optional(),
			}),
		)
		.mutation(({ ctx, input }) => change(ctx, () => getStore().create(input))),

	answer: protectedProcedure
		.input(z.object({ actor, id: z.string(), answer: longText }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().answer(input.actor, input.id, input.answer)),
		),

	dismiss: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().dismiss(input.actor, input.id)),
		),
});

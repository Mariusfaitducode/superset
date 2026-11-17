import { z } from "zod";
import {
	FINDING_PRIORITIES,
	OBSERVER_MISSIONS,
	OfficeObserverStore,
} from "../../../office-observer";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

let store: OfficeObserverStore | null = null;

function getStore(): OfficeObserverStore {
	store ??= new OfficeObserverStore();
	return store;
}

function change<T>(ctx: HostServiceContext, action: () => T): T {
	const result = action();
	ctx.eventBus.broadcastHostStoreChanged("office-observer");
	return result;
}

const conversation = {
	workspaceId: z.string().min(1),
	terminalId: z.string().min(1),
};

const finding = z.object({
	mission: z.enum(OBSERVER_MISSIONS),
	priority: z.enum(FINDING_PRIORITIES).optional(),
	title: z.string().trim().min(1).max(300),
	detail: z.string().max(2_000).nullish(),
	link: z
		.url({ protocol: /^https?$/ })
		.max(2_000)
		.nullish(),
	workspaceId: z.string().min(1).nullish(),
	terminalId: z.string().min(1).nullish(),
});

/**
 * The Office observer: an agent that reads every other agent and hands the
 * user a synthesis. Its runs live in a file under the Superset home, like
 * the reports, so the fork adds no migration to rebase.
 */
export const officeObserverRouter = router({
	get: protectedProcedure
		.input(
			z
				.object({ limit: z.number().int().min(1).max(20).default(5) })
				.default({ limit: 5 }),
		)
		.query(({ input }) => getStore().get(input.limit)),

	setConfig: protectedProcedure
		.input(z.object({ agent: z.string().max(200).nullable() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().setConfig(input)),
		),

	begin: protectedProcedure
		.input(z.object(conversation))
		.mutation(({ ctx, input }) => change(ctx, () => getStore().begin(input))),

	publish: protectedProcedure
		.input(
			z.object({
				...conversation,
				headline: z.string().trim().min(1).max(300),
				findings: z.array(finding).max(30),
				file: z.string().max(1_000).nullish(),
			}),
		)
		.mutation(({ ctx, input }) => change(ctx, () => getStore().publish(input))),
});

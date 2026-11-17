import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { PinnableWorkState } from "renderer/lib/agent-state";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostStoreRefresh } from "../useHostStoreRefresh";

export type ConversationMark = Awaited<
	ReturnType<HostServiceClient["conversationStates"]["list"]["query"]>
>[number];

export type AnyAgentReport = Awaited<
	ReturnType<HostServiceClient["agentReports"]["list"]["query"]>
>[number];

const hostsWithoutMarks = new Set<string>();

export function hostConversationMarksQueryKey(hostUrl: string | null) {
	return ["host-conversation-marks", hostUrl] as const;
}

/** Null data on hosts too old to keep pinned states; they are not asked again. */
export function hostConversationMarksQuery(hostUrl: string | null) {
	return {
		queryKey: hostConversationMarksQueryKey(hostUrl),
		queryFn: async (): Promise<ConversationMark[] | null> => {
			if (!hostUrl || hostsWithoutMarks.has(hostUrl)) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).conversationStates.list.query({});
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutMarks.add(hostUrl);
				return null;
			}
		},
		refetchInterval: 60_000,
		staleTime: 5_000,
	};
}

export function hostAllAgentReportsQueryKey(hostUrl: string | null) {
	return ["host-agent-reports-all", hostUrl] as const;
}

/**
 * Every report of a host, open or closed: an acknowledged DONE still says
 * the conversation is done. Null on hosts too old to keep reports.
 */
export function hostAllAgentReportsQuery(hostUrl: string | null) {
	return {
		queryKey: hostAllAgentReportsQueryKey(hostUrl),
		queryFn: async (): Promise<AnyAgentReport[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(hostUrl).agentReports.list.query(
					{},
				);
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				return null;
			}
		},
		refetchInterval: 60_000,
		staleTime: 5_000,
	};
}

/** A host's pinned conversation states and its reports, kept fresh. */
export function useHostWorkStateSources(
	hostUrl: string | null,
	enabled: boolean,
) {
	const marksQuery = hostConversationMarksQuery(hostUrl);
	const reportsQuery = hostAllAgentReportsQuery(hostUrl);
	const active = enabled && hostUrl !== null;
	useHostStoreRefresh({
		hostUrl,
		store: "conversation-states",
		queryKey: marksQuery.queryKey,
		enabled: active,
	});
	useHostStoreRefresh({
		hostUrl,
		store: "agent-reports",
		queryKey: reportsQuery.queryKey,
		enabled: active,
	});
	const marks = useQuery({
		...marksQuery,
		enabled: active,
		placeholderData: (previous) => previous,
	});
	const reports = useQuery({
		...reportsQuery,
		enabled: active,
		placeholderData: (previous) => previous,
	});
	return {
		/** False on hosts too old to keep pinned states. */
		canPin: hostUrl !== null && !hostsWithoutMarks.has(hostUrl),
		marks: marks.data ?? null,
		reports: reports.data ?? null,
	};
}

export interface ConversationMarkActions {
	set: (
		workspaceId: string,
		terminalId: string,
		state: PinnableWorkState,
	) => Promise<void>;
	clear: (terminalId: string) => Promise<void>;
}

export function useConversationMarkActions(
	hostUrl: string | null,
): ConversationMarkActions {
	const queryClient = useQueryClient();
	const refresh = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: hostConversationMarksQueryKey(hostUrl),
			}),
		[queryClient, hostUrl],
	);
	return useMemo(
		() => ({
			set: async (workspaceId, terminalId, state) => {
				if (!hostUrl) return;
				await getHostServiceClientByUrl(hostUrl).conversationStates.set.mutate({
					workspaceId,
					terminalId,
					state,
				});
				await refresh();
			},
			clear: async (terminalId) => {
				if (!hostUrl) return;
				await getHostServiceClientByUrl(
					hostUrl,
				).conversationStates.clear.mutate({ terminalId });
				await refresh();
			},
		}),
		[hostUrl, refresh],
	);
}

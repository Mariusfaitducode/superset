import { useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { hostAgentReportsQueryKey } from "renderer/hooks/host-service/useHostAgentReports";
import { hostConversationTodosQueryKey } from "renderer/hooks/host-service/useHostConversationTodos";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import type { DeskItem } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { deskMessage } from "../../utils/deskMessage";

export interface DeskActions {
	open: (item: DeskItem) => void;
	answer: (item: DeskItem, text: string) => Promise<boolean>;
	approveDraft: (item: DeskItem, editedText: string | null) => Promise<boolean>;
	review: (item: DeskItem, followUp: string) => Promise<boolean>;
	dismiss: (item: DeskItem) => Promise<boolean>;
	checkTodo: (item: DeskItem) => Promise<boolean>;
}

/**
 * Answers go into the conversation's terminal through the same host call as
 * `superset terminals send`; the report closes only once that worked, so a
 * failed send leaves it on the Desk.
 */
export function useDeskActions(): DeskActions {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMemo(() => {
		const refresh = (item: DeskItem) =>
			queryClient.invalidateQueries({
				queryKey:
					item.source === "report"
						? hostAgentReportsQueryKey(item.hostUrl)
						: hostConversationTodosQueryKey(item.hostUrl),
			});

		const attempt = async (
			item: DeskItem,
			action: () => Promise<unknown>,
		): Promise<boolean> => {
			try {
				await action();
				return true;
			} catch (error) {
				toast.error(t`Could not reach the conversation`, {
					description: error instanceof Error ? error.message : undefined,
				});
				return false;
			} finally {
				void refresh(item);
			}
		};

		const send = (item: DeskItem, text: string) =>
			getHostServiceClientByUrl(item.hostUrl).terminal.send.mutate({
				workspaceId: item.workspaceId,
				terminalId: item.terminalId,
				text,
			});

		const close = (item: DeskItem, answer: string) =>
			item.source === "report"
				? getHostServiceClientByUrl(item.hostUrl).agentReports.answer.mutate({
						id: item.report.id,
						answer,
					})
				: Promise.resolve();

		return {
			open: (item) => {
				void navigateToV2Workspace(item.workspaceId, navigate, {
					search: {
						terminalId: item.terminalId,
						focusRequestId: crypto.randomUUID(),
					},
				});
			},
			answer: (item, text) =>
				attempt(item, async () => {
					await send(item, deskMessage(item, { type: "answer", text }));
					await close(item, text);
				}),
			approveDraft: (item, editedText) =>
				attempt(item, async () => {
					await send(item, deskMessage(item, { type: "approve", editedText }));
					await close(item, editedText ?? "Approved");
				}),
			review: (item, followUp) =>
				attempt(item, async () => {
					if (followUp) {
						await send(
							item,
							deskMessage(item, { type: "review", text: followUp }),
						);
					}
					await close(item, followUp || "Reviewed");
				}),
			dismiss: (item) =>
				attempt(item, async () => {
					if (item.source !== "report") return;
					await getHostServiceClientByUrl(
						item.hostUrl,
					).agentReports.dismiss.mutate({ id: item.report.id });
				}),
			checkTodo: (item) =>
				attempt(item, async () => {
					if (item.source !== "todo") return;
					await getHostServiceClientByUrl(
						item.hostUrl,
					).conversationTodos.setDone.mutate({ id: item.todo.id, done: true });
				}),
		};
	}, [navigate, queryClient, t]);
}

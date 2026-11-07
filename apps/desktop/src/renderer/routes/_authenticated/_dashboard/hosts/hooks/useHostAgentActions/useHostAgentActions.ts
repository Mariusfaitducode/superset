import { useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { toast } from "@superset/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { getTerminalAgentBindingsQueryKey } from "renderer/hooks/host-service/useTerminalAgentBindings";
import { closeTerminal } from "renderer/lib/closeTerminal";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";

/** Same bound as the workspace's own terminal launcher. */
const CREATE_SESSION_TIMEOUT_MS = 30_000;

export interface HostAgentActions {
	openAgent: (workspaceId: string, terminalId: string) => void;
	stopAgent: (workspaceId: string, terminalId: string) => Promise<void>;
	startAgent: (workspaceId: string, agentConfigId: string) => Promise<void>;
	openTerminal: (workspaceId: string) => Promise<void>;
}

/**
 * What the hosts page does to a host's agents. Opening a terminal id on the
 * workspace route adds its pane when the layout lacks it, so a session
 * started here shows up like any other.
 */
export function useHostAgentActions(hostUrl: string | null): HostAgentActions {
	const { t } = useLingui();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const openAgent = useCallback(
		(workspaceId: string, terminalId: string) => {
			void navigateToV2Workspace(workspaceId, navigate, {
				search: { terminalId, focusRequestId: crypto.randomUUID() },
			});
		},
		[navigate],
	);

	const refreshBindings = useCallback(
		(workspaceId: string) =>
			queryClient.invalidateQueries({
				queryKey: getTerminalAgentBindingsQueryKey(workspaceId),
			}),
		[queryClient],
	);

	const stopAgent = useCallback(
		async (workspaceId: string, terminalId: string) => {
			if (!hostUrl) return;
			try {
				await closeTerminal(
					getHostServiceClientByUrl(hostUrl),
					workspaceId,
					terminalId,
				);
			} catch (error) {
				toast.error(t({ message: "Couldn't stop the agent" }), {
					description: errorMessage(error),
				});
			} finally {
				void refreshBindings(workspaceId);
			}
		},
		[hostUrl, refreshBindings, t],
	);

	const startAgent = useCallback(
		async (workspaceId: string, agentConfigId: string) => {
			if (!hostUrl) return;
			try {
				const { sessionId } = await getHostServiceClientByUrl(
					hostUrl,
				).agents.run.mutate({ workspaceId, agent: agentConfigId });
				void refreshBindings(workspaceId);
				openAgent(workspaceId, sessionId);
			} catch (error) {
				toast.error(t({ message: "Couldn't start the agent" }), {
					description: errorMessage(error),
				});
			}
		},
		[hostUrl, openAgent, refreshBindings, t],
	);

	const openTerminal = useCallback(
		async (workspaceId: string) => {
			if (!hostUrl) return;
			const terminalId = crypto.randomUUID();
			try {
				await getHostServiceClientByUrl(hostUrl).terminal.createSession.mutate(
					{ terminalId, workspaceId },
					{ signal: AbortSignal.timeout(CREATE_SESSION_TIMEOUT_MS) },
				);
				openAgent(workspaceId, terminalId);
			} catch (error) {
				toast.error(t({ message: "Couldn't open a terminal" }), {
					description: errorMessage(error),
				});
			}
		},
		[hostUrl, openAgent, t],
	);

	return useMemo(
		() => ({ openAgent, stopAgent, startAgent, openTerminal }),
		[openAgent, stopAgent, startAgent, openTerminal],
	);
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useHostStoreRefresh } from "renderer/hooks/host-service/useHostStoreRefresh";
import { useV2AgentConfigs } from "renderer/hooks/useV2AgentConfigs";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import {
	latestSynthesis,
	type ObserverRun,
	observerStatus,
} from "renderer/routes/_authenticated/_dashboard/office/utils/observerStatus";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";

/** What a run is asked to do; the skill holds the instructions. */
export const OBSERVER_PROMPT =
	"Run the Office observer: load the superset:observer skill and follow it.";

/** Run sessions carry this name, which the skill archives on the next run. */
export function observerSessionName(at: Date): string {
	const stamp = at.toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
	return `Observer · ${stamp}`;
}

/**
 * The observer of this machine's host: its runs, the agent "Run now"
 * starts, and the start itself, as a fresh session each time so a run never
 * inherits the previous one's context.
 */
export function useOfficeObserver() {
	const { activeHostUrl: hostUrl } = useLocalHostService();
	const queryClient = useQueryClient();
	const queryKey = useMemo(
		() => ["office-observer", hostUrl] as const,
		[hostUrl],
	);

	const query = useQuery({
		queryKey,
		queryFn: async () => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).officeObserver.get.query({ limit: 10 });
			} catch (error) {
				if (isMissingProcedureError(error)) return null;
				throw error;
			}
		},
		enabled: !!hostUrl,
		refetchInterval: 60_000,
		staleTime: 5_000,
	});
	useHostStoreRefresh({
		hostUrl,
		store: "office-observer",
		queryKey,
		enabled: !!hostUrl && query.data !== null,
	});

	const { data: agentConfigs } = useV2AgentConfigs(hostUrl);
	// The skill is written for Claude Code.
	const agents = useMemo(
		() => (agentConfigs ?? []).filter((config) => config.presetId === "claude"),
		[agentConfigs],
	);
	const chosenAgent = query.data?.config.agent ?? null;
	// Until the user picks one, an agent set up for unattended automations
	// runs without stopping on permission prompts.
	const agentId =
		agents.find((config) => config.id === chosenAgent)?.id ??
		agents.find((config) => /automation/i.test(config.label))?.id ??
		agents[0]?.id ??
		null;

	const [startRequestedAt, setStartRequestedAt] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(timer);
	}, []);

	const run = useMutation({
		mutationFn: async () => {
			if (!hostUrl || !agentId) throw new Error("No Claude agent on this host");
			const startedAt = new Date();
			const result = await getHostServiceClientByUrl(
				hostUrl,
			).workspaces.createSession.mutate({
				name: observerSessionName(startedAt),
				agents: [{ agent: agentId, prompt: OBSERVER_PROMPT }],
			});
			return { workspaceId: result.workspace.id, at: startedAt.getTime() };
		},
		onMutate: () => {
			const at = Date.now();
			setStartRequestedAt(at);
			setNow(at);
		},
		onError: () => setStartRequestedAt(null),
	});

	const setAgent = useMutation({
		mutationFn: async (agent: string) => {
			if (!hostUrl) return;
			await getHostServiceClientByUrl(hostUrl).officeObserver.setConfig.mutate({
				agent,
			});
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey }),
	});

	const runs: ObserverRun[] = query.data?.runs ?? [];
	return {
		/** False on a host too old to keep observer runs. */
		available: query.data !== null,
		runs,
		status: observerStatus(runs, now, startRequestedAt),
		synthesis: latestSynthesis(runs),
		agents,
		agentId,
		setAgent: setAgent.mutate,
		run: run.mutate,
		runError: run.error,
	};
}

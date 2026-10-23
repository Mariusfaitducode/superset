import {
	type QueryClient,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { getHostEventBus } from "renderer/lib/host-event-bus";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	isActiveNote,
	type NoteStatus,
	sortNotes,
	type WorkspaceNote,
} from "./notes";

const hostsWithoutNotes = new Set<string>();

// The host takes at most this many notes per call.
const ADD_BATCH = 200;

export interface NoteActions {
	add: (texts: string[]) => Promise<void>;
	update: (
		id: string,
		fields: {
			text?: string;
			details?: string | null;
			kind?: WorkspaceNote["kind"];
		},
	) => Promise<void>;
	setStatus: (id: string, status: NoteStatus) => Promise<void>;
	remove: (id: string) => Promise<void>;
}

function notesQueryKey(hostUrl: string | null) {
	return ["workspace-notes", hostUrl] as const;
}

function notesQuery(hostUrl: string | null) {
	return {
		queryKey: notesQueryKey(hostUrl),
		enabled: hostUrl !== null && !hostsWithoutNotes.has(hostUrl),
		queryFn: async (): Promise<WorkspaceNote[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).workspaceNotes.list.query({});
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutNotes.add(hostUrl);
				return null;
			}
		},
		// The host's `workspace-notes:changed` event refetches it, agents'
		// changes included, so nothing polls.
		staleTime: 60_000,
	};
}

const hostListeners = new Map<string, { count: number; stop: () => void }>();

/** One event listener per host, however many rows and views ask for it. */
function useNotesEvents(hostUrls: Array<string | null>) {
	const queryClient = useQueryClient();
	const key = [...new Set(hostUrls.filter((url) => url !== null))]
		.sort()
		.join("\n");

	useEffect(() => {
		const urls = key ? key.split("\n") : [];
		for (const url of urls) {
			const entry = hostListeners.get(url);
			if (entry) {
				entry.count += 1;
				continue;
			}
			const stop = getHostEventBus(url).on(
				"workspace-notes:changed",
				"*",
				() => {
					void queryClient.invalidateQueries({
						queryKey: notesQueryKey(url),
					});
				},
			);
			hostListeners.set(url, { count: 1, stop });
		}
		return () => {
			for (const url of urls) {
				const entry = hostListeners.get(url);
				if (!entry) continue;
				entry.count -= 1;
				if (entry.count === 0) {
					entry.stop();
					hostListeners.delete(url);
				}
			}
		};
	}, [key, queryClient]);
}

function useResolveHostUrl() {
	const { cache } = useHostWorkspaces();
	return useCallback(
		(hostId: string) =>
			cache.isSandboxHost(hostId) ? null : cache.resolveHostUrl(hostId),
		[cache],
	);
}

/** The calls that change one workspace's notes on its host. */
export function noteActions(
	queryClient: QueryClient,
	hostUrl: string | null,
	workspaceId: string,
): NoteActions {
	const mutate = async (
		call: (client: HostServiceClient["workspaceNotes"]) => Promise<unknown>,
	) => {
		if (!hostUrl) return;
		await call(getHostServiceClientByUrl(hostUrl).workspaceNotes);
		await queryClient.invalidateQueries({ queryKey: notesQueryKey(hostUrl) });
	};
	return {
		add: (texts) =>
			mutate(async (client) => {
				for (let i = 0; i < texts.length; i += ADD_BATCH) {
					await client.add.mutate({
						workspaceId,
						items: texts.slice(i, i + ADD_BATCH).map((text) => ({ text })),
					});
				}
			}),
		update: (id, fields) =>
			mutate((client) => client.update.mutate({ id, ...fields })),
		setStatus: (id, status) =>
			mutate((client) => client.setStatus.mutate({ id, status })),
		remove: (id) => mutate((client) => client.remove.mutate({ id })),
	};
}

/**
 * A workspace's notes, from its host, where agents read and add them too.
 * One query per host serves every row of that host. `notes` is null on
 * hosts too old to keep notes.
 */
export function useWorkspaceNotes(workspaceId: string, hostId: string) {
	const queryClient = useQueryClient();
	const hostUrl = useResolveHostUrl()(hostId);
	const query = useQuery(notesQuery(hostUrl));
	useNotesEvents([hostUrl]);

	const notes = useMemo(
		() =>
			query.data
				? sortNotes(
						query.data.filter((note) => note.workspaceId === workspaceId),
					)
				: null,
		[query.data, workspaceId],
	);
	const activeCount = notes?.filter(isActiveNote).length ?? 0;

	const actions = useMemo(
		() => noteActions(queryClient, hostUrl, workspaceId),
		[queryClient, hostUrl, workspaceId],
	);

	return { notes, activeCount, actions };
}

export interface HostNotes {
	hostId: string;
	hostUrl: string | null;
	notes: WorkspaceNote[];
}

/** Every listed host's notes, for the Notes view. */
export function useNotesByHost(hostIds: string[]): HostNotes[] {
	const resolveHostUrl = useResolveHostUrl();
	const key = [...new Set(hostIds)].sort().join(",");
	const hosts = useMemo(
		() =>
			(key ? key.split(",") : []).map((hostId) => ({
				hostId,
				hostUrl: resolveHostUrl(hostId),
			})),
		[key, resolveHostUrl],
	);
	useNotesEvents(hosts.map((host) => host.hostUrl));

	const combine = useCallback(
		(results: Array<{ data?: WorkspaceNote[] | null }>) =>
			hosts.flatMap((host, index) => {
				const notes = results[index]?.data;
				return notes ? [{ ...host, notes }] : [];
			}),
		[hosts],
	);
	return useQueries({
		queries: hosts.map((host) => notesQuery(host.hostUrl)),
		combine,
	});
}

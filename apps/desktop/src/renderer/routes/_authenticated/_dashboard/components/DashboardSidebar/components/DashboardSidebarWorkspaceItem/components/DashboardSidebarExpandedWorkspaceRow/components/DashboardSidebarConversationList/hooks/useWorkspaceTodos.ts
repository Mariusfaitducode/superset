import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useConversationTodosStore } from "renderer/stores/conversation-todos";
import { compareTodos } from "../utils/todo-order";

export type ConversationTodo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

export type TodoFields = Omit<
	Parameters<HostServiceClient["conversationTodos"]["update"]["mutate"]>[0],
	"id" | "actor"
>;

export interface TodoActions {
	add: (terminalId: string, text: string) => Promise<void>;
	update: (id: string, fields: TodoFields) => Promise<void>;
	setDone: (id: string, done: boolean) => Promise<void>;
	remove: (id: string) => Promise<void>;
	clearDone: (terminalId: string) => Promise<void>;
}

const hostsWithoutTodos = new Set<string>();
const importing = new Set<string>();

/**
 * Before to-dos moved to the host they lived in this app's local storage.
 * Each conversation's list is copied over once, the first time its
 * workspace's to-dos load, then dropped locally.
 */
async function importLocalTodos(
	client: HostServiceClient,
	workspaceId: string,
	terminalIds: string[],
): Promise<boolean> {
	const store = useConversationTodosStore.getState();
	let imported = false;
	for (const terminalId of terminalIds) {
		const local = store.todosByConversation[terminalId];
		if (!local?.length || importing.has(terminalId)) continue;
		importing.add(terminalId);
		try {
			for (const todo of local) {
				const added = await client.conversationTodos.add.mutate({
					workspaceId,
					terminalId,
					text: todo.text,
				});
				if (todo.done) {
					await client.conversationTodos.setDone.mutate({
						id: added.id,
						done: true,
					});
				}
				useConversationTodosStore.getState().removeTodo(terminalId, todo.id);
			}
			imported = true;
		} finally {
			importing.delete(terminalId);
		}
	}
	return imported;
}

/**
 * The to-dos of a workspace's conversations, from their host, where agents
 * read and write them too. Polled, since agents change them from the CLI.
 * `available` is false on hosts too old to keep to-dos.
 */
export function useWorkspaceTodos({
	workspaceId,
	hostId,
	terminalIds,
	enabled,
}: {
	workspaceId: string;
	hostId: string;
	terminalIds: string[];
	enabled: boolean;
}) {
	const queryClient = useQueryClient();
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);
	const queryKey = useMemo(
		() => ["sidebar-conversation-todos", hostUrl, workspaceId],
		[hostUrl, workspaceId],
	);

	const query = useQuery({
		queryKey,
		enabled:
			enabled &&
			hostUrl !== null &&
			terminalIds.length > 0 &&
			!hostsWithoutTodos.has(hostUrl),
		queryFn: async (): Promise<ConversationTodo[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).conversationTodos.list.query({ workspaceId });
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutTodos.add(hostUrl);
				return null;
			}
		},
		refetchInterval: 10_000,
		staleTime: 5_000,
		placeholderData: (previous) => previous,
	});

	const terminalKey = terminalIds.join(",");
	const loaded = query.data != null;
	useEffect(() => {
		if (!loaded || !hostUrl || !terminalKey) return;
		void importLocalTodos(
			getHostServiceClientByUrl(hostUrl),
			workspaceId,
			terminalKey.split(","),
		).then((imported) => {
			if (imported) void queryClient.invalidateQueries({ queryKey });
		});
	}, [loaded, hostUrl, workspaceId, terminalKey, queryClient, queryKey]);

	const byTerminal = useMemo(() => {
		const map = new Map<string, ConversationTodo[]>();
		for (const todo of query.data ?? []) {
			const list = map.get(todo.terminalId) ?? [];
			list.push(todo);
			map.set(todo.terminalId, list);
		}
		for (const list of map.values()) list.sort(compareTodos);
		return map;
	}, [query.data]);

	const mutate = useCallback(
		async (
			call: (
				client: HostServiceClient["conversationTodos"],
			) => Promise<unknown>,
		) => {
			if (!hostUrl) return;
			await call(getHostServiceClientByUrl(hostUrl).conversationTodos);
			await queryClient.invalidateQueries({ queryKey });
		},
		[hostUrl, queryClient, queryKey],
	);

	const actions = useMemo<TodoActions>(
		() => ({
			add: (terminalId, text) =>
				mutate((client) =>
					client.add.mutate({ workspaceId, terminalId, text }),
				),
			update: (id, fields) =>
				mutate((client) => client.update.mutate({ id, ...fields })),
			setDone: (id, done) =>
				mutate((client) => client.setDone.mutate({ id, done })),
			remove: (id) => mutate((client) => client.remove.mutate({ id })),
			clearDone: (terminalId) =>
				mutate((client) => client.clearDone.mutate({ terminalId })),
		}),
		[mutate, workspaceId],
	);

	return { available: query.data != null, byTerminal, actions };
}

import {
	type QueryClient,
	type QueryKey,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { getHostEventBus } from "renderer/lib/host-event-bus";

export type HostStore = "conversation-todos" | "workspace-labels";

const holds = new Map<string, { count: number; release: () => void }>();

/**
 * Refetches `queryKey` when the host says one of its stores changed. One
 * listener per host, store and query, however many rows ask for it. Answers
 * the release.
 */
export function holdHostStoreRefresh(
	hostUrl: string,
	store: HostStore,
	queryClient: QueryClient,
	queryKey: QueryKey,
): () => void {
	const id = `${hostUrl}\0${store}\0${JSON.stringify(queryKey)}`;
	let entry = holds.get(id);
	if (!entry) {
		const bus = getHostEventBus(hostUrl);
		const removeListener = bus.on(
			"host-store:changed",
			"*",
			(_scope, payload) => {
				if (payload.store !== store) return;
				void queryClient.invalidateQueries(
					{ queryKey },
					{ cancelRefetch: false },
				);
			},
		);
		const releaseBus = bus.retain();
		entry = {
			count: 0,
			release: () => {
				removeListener();
				releaseBus();
			},
		};
		holds.set(id, entry);
	}
	entry.count += 1;
	const held = entry;
	return () => {
		held.count -= 1;
		if (held.count > 0) return;
		held.release();
		holds.delete(id);
	};
}

/** {@link holdHostStoreRefresh} while mounted and enabled. */
export function useHostStoreRefresh({
	hostUrl,
	store,
	queryKey,
	enabled,
}: {
	hostUrl: string | null;
	store: HostStore;
	queryKey: QueryKey;
	enabled: boolean;
}): void {
	const queryClient = useQueryClient();
	const keyId = JSON.stringify(queryKey);
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyId stands for queryKey
	useEffect(() => {
		if (!enabled || !hostUrl) return;
		return holdHostStoreRefresh(hostUrl, store, queryClient, queryKey);
	}, [enabled, hostUrl, store, queryClient, keyId]);
}

import { expect, test } from "bun:test";
import { fetchHostMetrics, type HostMetrics } from "./fetchHostMetrics";

type Client = Parameters<typeof fetchHostMetrics>[0];

function clientWith(query: () => Promise<unknown>): Client {
	return { host: { metrics: { query } } } as unknown as Client;
}

test("a host without host.metrics reads as unsupported, not as an error", async () => {
	const client = clientWith(async () => {
		throw new Error('No procedure found on path "host.metrics"');
	});
	expect(await fetchHostMetrics(client)).toEqual({ status: "unsupported" });
});

test("other failures still reject so the query can retry", async () => {
	const client = clientWith(async () => {
		throw new Error("Failed to fetch");
	});
	await expect(fetchHostMetrics(client)).rejects.toThrow("Failed to fetch");
});

test("a current host returns its metrics", async () => {
	const metrics = { hostname: "tower" } as HostMetrics;
	const client = clientWith(async () => metrics);
	expect(await fetchHostMetrics(client)).toEqual({ status: "ok", metrics });
});

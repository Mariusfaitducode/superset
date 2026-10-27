import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	MAX_CACHED_RESULTS,
	MyPullRequestsCache,
} from "./my-pull-requests-cache";

const dirs: string[] = [];
async function cachePath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "my-prs-cache-"));
	dirs.push(dir);
	return join(dir, "nested", "cache.json");
}

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("MyPullRequestsCache", () => {
	test("a new instance reads what an earlier one wrote", async () => {
		const path = await cachePath();
		await new MyPullRequestsCache<{ n: number }>(path).remember("a", { n: 1 });
		const reopened = new MyPullRequestsCache<{ n: number }>(path);
		expect(await reopened.get("a")).toEqual({ n: 1 });
		expect(await reopened.get("b")).toBeNull();
	});

	test("keeps only the most recent entries", async () => {
		const path = await cachePath();
		const cache = new MyPullRequestsCache<number>(path);
		for (let index = 0; index <= MAX_CACHED_RESULTS; index++) {
			await cache.remember(`k${index}`, index);
		}
		expect(await cache.get("k0")).toBeNull();
		const file = JSON.parse(await readFile(path, "utf-8"));
		expect(file.entries).toHaveLength(MAX_CACHED_RESULTS);
	});

	test("starts empty on a missing or corrupt file", async () => {
		const path = await cachePath();
		expect(await new MyPullRequestsCache(path).get("a")).toBeNull();
		const corrupt = join(dirs[0] as string, "corrupt.json");
		await writeFile(corrupt, "{not json");
		const cache = new MyPullRequestsCache<number>(corrupt);
		expect(await cache.get("a")).toBeNull();
		await cache.remember("a", 1);
		expect(await new MyPullRequestsCache<number>(corrupt).get("a")).toBe(1);
	});
});

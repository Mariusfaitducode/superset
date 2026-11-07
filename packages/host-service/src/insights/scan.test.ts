import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	appendFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanTranscripts } from "./scan";

const NOW = Date.parse("2026-10-14T12:00:00Z");

function line(minute: number, text: string): string {
	return JSON.stringify({
		type: "user",
		timestamp: new Date(NOW - (60 - minute) * 60_000).toISOString(),
		cwd: "/repo",
		message: { role: "user", content: text },
	});
}

describe("scanTranscripts", () => {
	let dir: string;
	let file: string;
	const scan = (budgetMs?: number) =>
		scanTranscripts({
			root: join(dir, "projects"),
			cachePath: join(dir, "cache.json"),
			nowMs: NOW,
			budgetMs,
		});

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "insights-scan-"));
		mkdirSync(join(dir, "projects", "-repo"), { recursive: true });
		file = join(dir, "projects", "-repo", "abc.jsonl");
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	test("reads only appended lines and waits for a line to end", async () => {
		writeFileSync(file, `${line(1, "first")}\n`);
		expect((await scan()).cache.files[file]?.events).toHaveLength(1);

		const second = line(2, "second");
		appendFileSync(file, second.slice(0, 20));
		expect((await scan()).cache.files[file]?.events).toHaveLength(1);

		appendFileSync(file, `${second.slice(20)}\n`);
		const { cache } = await scan();
		expect(cache.files[file]?.events).toHaveLength(2);
		expect(cache.files[file]?.cwdCounts).toEqual({ "/repo": 2 });
	});

	test("rereads a file that shrank and forgets a deleted one", async () => {
		writeFileSync(file, `${line(1, "a")}\n${line(2, "b")}\n`);
		await scan();
		writeFileSync(file, `${line(3, "c")}\n`);
		expect((await scan()).cache.files[file]?.events).toHaveLength(1);

		rmSync(file);
		expect((await scan()).cache.files[file]).toBeUndefined();
	});

	test("stops at the budget and resumes on the next scan", async () => {
		writeFileSync(file, `${line(1, "a")}\n`);
		const cut = await scan(-1);
		expect(cut.complete).toBe(false);
		expect(cut.cache.files[file]).toBeUndefined();
		const resumed = await scan();
		expect(resumed.complete).toBe(true);
		expect(resumed.cache.files[file]?.events).toHaveLength(1);
	});
});

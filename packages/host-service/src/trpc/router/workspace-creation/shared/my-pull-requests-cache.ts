import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// A few entries cover the project filters in use.
export const MAX_CACHED_RESULTS = 4;
const CACHE_VERSION = 1;

interface CacheFile<T> {
	version: number;
	entries: Array<[string, T]>;
}

export function defaultMyPullRequestsCachePath(): string {
	const base =
		process.env.HOST_MANIFEST_DIR?.trim() ||
		join(homedir(), ".superset", "host", "standalone");
	return join(base, "my-pull-requests-cache.json");
}

/**
 * The last Mine answer per project set, in memory and on disk, so the view
 * shows a list at once even right after the host restarts. One file of at
 * most MAX_CACHED_RESULTS entries, rewritten on each fresh answer.
 */
export class MyPullRequestsCache<T> {
	private readonly entries = new Map<string, T>();
	private loading: Promise<void> | null = null;
	private writing: Promise<void> = Promise.resolve();

	constructor(private readonly path: string) {}

	async get(key: string): Promise<T | null> {
		await this.load();
		return this.entries.get(key) ?? null;
	}

	async remember(key: string, value: T): Promise<void> {
		await this.load();
		this.entries.delete(key);
		this.entries.set(key, value);
		for (const oldest of this.entries.keys()) {
			if (this.entries.size <= MAX_CACHED_RESULTS) break;
			this.entries.delete(oldest);
		}
		const file: CacheFile<T> = {
			version: CACHE_VERSION,
			entries: [...this.entries],
		};
		this.writing = this.writing.then(() => this.write(file)).catch(() => {});
		await this.writing;
	}

	private load(): Promise<void> {
		this.loading ??= readFile(this.path, "utf-8")
			.then((text) => {
				const file = JSON.parse(text) as CacheFile<T>;
				if (file?.version !== CACHE_VERSION || !Array.isArray(file.entries))
					return;
				for (const [key, value] of file.entries.slice(-MAX_CACHED_RESULTS)) {
					if (typeof key === "string" && !this.entries.has(key))
						this.entries.set(key, value);
				}
			})
			// Missing or unreadable: start empty, the next fresh answer rewrites it.
			.catch(() => {});
		return this.loading;
	}

	private async write(file: CacheFile<T>): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		const tempPath = `${this.path}.${process.pid}.tmp`;
		await writeFile(tempPath, JSON.stringify(file), { mode: 0o600 });
		await rename(tempPath, this.path);
	}
}

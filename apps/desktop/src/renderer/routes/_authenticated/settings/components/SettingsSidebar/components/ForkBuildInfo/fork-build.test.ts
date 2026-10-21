import { describe, expect, test } from "bun:test";
import { parseForkBuild } from "./fork-build";

describe("parseForkBuild", () => {
	test("reads the stamp update.sh writes", () => {
		const build = parseForkBuild(
			'{"status":"wip","branch":"feature/x","commit":"abc","dirty":true,"release":"","baseRelease":"marius-v1.39.0-2","latestRelease":"marius-v1.39.0-2","upstream":"desktop-v1.39.0","builtAt":"2026-10-21T10:26:11Z"}',
		);
		expect(build).toMatchObject({
			status: "wip",
			dirty: true,
			branch: "feature/x",
		});
	});

	test("ignores a missing, older or broken stamp", () => {
		expect(parseForkBuild(undefined)).toBeNull();
		expect(
			parseForkBuild("desktop-v1.39.0 + main@abc · 2026-10-20"),
		).toBeNull();
		expect(parseForkBuild("{broken")).toBeNull();
		expect(parseForkBuild('{"status":"other"}')).toBeNull();
	});
});

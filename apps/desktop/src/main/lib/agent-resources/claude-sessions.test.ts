import { describe, expect, it } from "bun:test";
import type {
	ProcessInfo,
	ProcessSnapshot,
} from "main/lib/resource-metrics/process-tree";
import { findAncestorIn, parseSessionFile } from "./claude-sessions";
import { buildResumeCommand } from "./closed-sessions-log";

describe("parseSessionFile", () => {
	it("reads what the view needs from a live CLI's session file", () => {
		expect(
			parseSessionFile(
				JSON.stringify({
					pid: 68006,
					sessionId: "1d81ec3e",
					cwd: "/Users/marius/hub",
					name: "fix-login",
					status: "busy",
					startedAt: 1,
					updatedAt: 2,
					kind: "interactive",
				}),
			),
		).toEqual({
			pid: 68006,
			sessionId: "1d81ec3e",
			cwd: "/Users/marius/hub",
			name: "fix-login",
			status: "busy",
			waitingFor: null,
			startedAt: 1,
			updatedAt: 2,
		});
	});

	it("keeps an unknown status unknown, so bulk close never treats it as idle", () => {
		expect(
			parseSessionFile(
				'{"pid":1,"sessionId":"s","cwd":"/","status":"compacting"}',
			)?.status,
		).toBe("unknown");
	});

	it("rejects files without a pid, session id or cwd", () => {
		expect(parseSessionFile('{"pid":1,"cwd":"/"}')).toBe(null);
		expect(parseSessionFile("not json")).toBe(null);
	});
});

describe("findAncestorIn", () => {
	it("finds the terminal shell a session runs under", () => {
		const byPid = new Map<number, ProcessInfo>([
			[10, { pid: 10, ppid: 1, cpu: 0, memory: 0, name: "Superset" }],
			[20, { pid: 20, ppid: 10, cpu: 0, memory: 0, name: "zsh" }],
			[30, { pid: 30, ppid: 20, cpu: 0, memory: 0, name: "claude" }],
		]);
		const snapshot: ProcessSnapshot = { byPid, childrenOf: new Map() };
		expect(findAncestorIn(snapshot, 30, new Map([[20, "terminal-a"]]))).toBe(
			"terminal-a",
		);
		expect(findAncestorIn(snapshot, 30, new Map([[99, "other"]]))).toBe(null);
	});
});

describe("buildResumeCommand", () => {
	it("quotes the cwd for the shell", () => {
		expect(buildResumeCommand("/Users/me/it's here", "abc")).toBe(
			`cd '/Users/me/it'\\''s here' && claude --resume abc`,
		);
	});
});

import { describe, expect, test } from "bun:test";
import {
	parseStep,
	parseSteps,
	progressLabel,
	resolveTaskId,
	type TrackedTask,
	trackActor,
	trackTerminal,
} from "./tracks";

describe("track CLI helpers", () => {
	test("splits steps on commas", () => {
		expect(parseSteps("Snapshot, Purge logs,,Check ")).toEqual([
			"Snapshot",
			"Purge logs",
			"Check",
		]);
		expect(parseSteps(" , ")).toBeUndefined();
		expect(parseSteps(undefined)).toBeUndefined();
	});

	test("numbers steps from 1, names stay names", () => {
		expect(parseStep("1")).toBe(0);
		expect(parseStep("3")).toBe(2);
		expect(parseStep("Purge logs")).toBe("Purge logs");
	});

	test("needs a Superset terminal, acts as the agent in one", () => {
		expect(
			trackTerminal({ SUPERSET_WORKSPACE_ID: "ws", SUPERSET_TERMINAL_ID: "t" }),
		).toEqual({ workspaceId: "ws", terminalId: "t" });
		expect(() => trackTerminal({})).toThrow();
		expect(trackActor({ SUPERSET_AGENT_ID: "claude" })).toBe("agent");
		expect(trackActor({})).toBe("user");
	});

	test("resolves an unambiguous short id", () => {
		const tasks = [{ id: "abc1" }, { id: "abd2" }];
		expect(resolveTaskId("abc", tasks)).toBe("abc1");
		expect(() => resolveTaskId("ab", tasks)).toThrow(/Several/);
		expect(() => resolveTaskId("zz", tasks)).toThrow(/not found/);
	});

	test("shows steps, CI jobs or a percentage", () => {
		const base = { steps: [], currentStep: null, progress: null, ci: null };
		const label = (fields: object) =>
			progressLabel({ ...base, ...fields } as unknown as TrackedTask);
		expect(label({ steps: ["a", "b"], currentStep: 1 })).toBe("2/2");
		expect(label({ ci: { jobsDone: 1, jobsTotal: 3 } })).toBe("1/3 jobs");
		expect(label({ progress: 40 })).toBe("40%");
		expect(label({})).toBe("");
	});
});

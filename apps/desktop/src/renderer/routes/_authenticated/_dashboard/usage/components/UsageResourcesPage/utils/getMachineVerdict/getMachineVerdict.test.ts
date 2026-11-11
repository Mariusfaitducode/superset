import { describe, expect, it } from "bun:test";
import type { AgentResourcesSnapshot } from "../../types";
import { getMachineVerdict } from "./getMachineVerdict";

const GB = 1024 ** 3;

function machine(
	overrides: Partial<AgentResourcesSnapshot["machine"]>,
): AgentResourcesSnapshot["machine"] {
	return {
		totalMemory: 16 * GB,
		usedMemory: 12 * GB,
		swapTotal: 16 * GB,
		swapUsed: 2 * GB,
		pressure: "normal",
		loadAverage1m: 4,
		cpuCoreCount: 10,
		docker: { memoryLimit: null, memoryUsed: null },
		...overrides,
	};
}

describe("getMachineVerdict", () => {
	it("follows macOS memory pressure", () => {
		expect(getMachineVerdict(machine({ pressure: "normal" }))).toBe("room");
		expect(getMachineVerdict(machine({ pressure: "warn" }))).toBe("tight");
		expect(getMachineVerdict(machine({ pressure: "critical" }))).toBe(
			"critical",
		);
	});

	it("calls it tight when swap is nearly full, even at normal pressure", () => {
		expect(getMachineVerdict(machine({ swapUsed: 15 * GB }))).toBe("tight");
	});

	it("stays unknown without a pressure reading", () => {
		expect(getMachineVerdict(machine({ pressure: null }))).toBe("unknown");
	});
});

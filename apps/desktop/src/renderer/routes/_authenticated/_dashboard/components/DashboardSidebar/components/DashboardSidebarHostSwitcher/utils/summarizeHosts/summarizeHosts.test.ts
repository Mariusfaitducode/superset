import { describe, expect, test } from "bun:test";
import type { PaneStatus } from "shared/tabs-types";
import { summarizeHosts } from "./summarizeHosts";

const hosts = [
	{ machineId: "tower", name: "Tour", isOnline: true },
	{ machineId: "mac-001", name: "Mac-001", isOnline: false },
	{ machineId: "mac", name: "Mac", isOnline: true },
];

const statusesByWorkspace: Record<string, PaneStatus[]> = {
	"w-tower-1": ["working", "permission"],
	"w-tower-2": ["failed", "review", "idle"],
	"w-mac": ["working"],
	"w-cloud": ["working"],
};

describe("summarizeHosts", () => {
	test("counts each host's agents by state, and every agent in the total", () => {
		const result = summarizeHosts({
			hosts,
			localMachineId: "mac",
			workspaces: [
				{ id: "w-tower-1", hostId: "tower" },
				{ id: "w-tower-2", hostId: "tower" },
				{ id: "w-tower-1", hostId: "tower" },
				{ id: "w-mac", hostId: "mac" },
				{ id: "w-cloud", hostId: "sandbox-1" },
			],
			agentStatuses: (id) => statusesByWorkspace[id],
		});
		const counts = Object.fromEntries(
			result.hosts.map((host) => [host.machineId, host.counts]),
		);
		expect(counts.tower).toEqual({ working: 1, needsYou: 2, idle: 2 });
		expect(counts.mac).toEqual({ working: 1, needsYou: 0, idle: 0 });
		expect(counts["mac-001"]).toEqual({ working: 0, needsYou: 0, idle: 0 });
		expect(result.total).toEqual({ working: 3, needsYou: 2, idle: 2 });
	});

	test("puts this device first, then online hosts, then by name", () => {
		const result = summarizeHosts({
			hosts,
			localMachineId: "mac-001",
			workspaces: [],
			agentStatuses: () => undefined,
		});
		expect(result.hosts.map((host) => host.name)).toEqual([
			"Mac-001",
			"Mac",
			"Tour",
		]);
		expect(result.hosts[0]?.isLocal).toBe(true);
	});
});

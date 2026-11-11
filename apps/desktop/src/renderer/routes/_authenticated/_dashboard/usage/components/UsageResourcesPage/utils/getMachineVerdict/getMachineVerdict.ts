import type { AgentResourcesSnapshot } from "../../types";

export type MachineVerdict = "room" | "tight" | "critical" | "unknown";

// Swap on its own lags: macOS keeps pages swapped out long after pressure
// drops, so it only tips the verdict when it is nearly full.
const SWAP_TIGHT_RATIO = 0.75;

/** Can the machine take another agent right now? */
export function getMachineVerdict(
	machine: AgentResourcesSnapshot["machine"],
): MachineVerdict {
	if (machine.pressure === "critical") return "critical";
	const swapRatio =
		machine.swapTotal > 0 ? machine.swapUsed / machine.swapTotal : 0;
	if (machine.pressure === "warn" || swapRatio >= SWAP_TIGHT_RATIO) {
		return "tight";
	}
	return machine.pressure === "normal" ? "room" : "unknown";
}

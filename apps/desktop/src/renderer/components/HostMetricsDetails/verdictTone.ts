import type { HostVerdict } from "renderer/hooks/host-service/useHostMetrics";

export const VERDICT_TONE: Record<
	HostVerdict,
	{ dot: string; text: string; bar: string }
> = {
	room: {
		dot: "bg-emerald-500",
		text: "text-foreground",
		bar: "bg-foreground/45",
	},
	tight: {
		dot: "bg-amber-500",
		text: "text-amber-600 dark:text-amber-400",
		bar: "bg-amber-500/80",
	},
	critical: {
		dot: "bg-red-500",
		text: "text-red-600 dark:text-red-400",
		bar: "bg-red-500/80",
	},
};

/** Bar color for one gauge, on the same thresholds as the local machine's. */
export function shareBarClass(share: number | null): string {
	if (share === null) return VERDICT_TONE.room.bar;
	if (share >= 0.9) return VERDICT_TONE.critical.bar;
	if (share >= 0.75) return VERDICT_TONE.tight.bar;
	return VERDICT_TONE.room.bar;
}

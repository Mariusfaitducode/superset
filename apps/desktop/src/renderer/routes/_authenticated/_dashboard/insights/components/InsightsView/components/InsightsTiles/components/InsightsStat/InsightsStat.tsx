import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";

export interface InsightsTile {
	label: string;
	value: string;
	previous: string | null;
	target: string | null;
	onTarget: boolean | null;
}

export function InsightsStat({ tile }: { tile: InsightsTile }) {
	const { t } = useLingui();
	return (
		<div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
			<span className="truncate text-[11px] text-muted-foreground">
				{tile.label}
			</span>
			<span
				className={cn(
					"text-lg font-medium tabular-nums",
					tile.onTarget === true && "text-emerald-600 dark:text-emerald-400",
					tile.onTarget === false && "text-amber-600 dark:text-amber-400",
				)}
			>
				{tile.value}
			</span>
			<span className="truncate text-[10px] text-muted-foreground">
				{[
					tile.previous !== null &&
						t({ message: `Last week ${tile.previous}` }),
					tile.target !== null && t({ message: `Goal ${tile.target}` }),
				]
					.filter(Boolean)
					.join(" · ")}
			</span>
		</div>
	);
}

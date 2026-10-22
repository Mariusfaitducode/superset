import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { LuSparkles } from "react-icons/lu";
import { formatMemory } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import {
	CLEANUP_THRESHOLD_HOURS,
	type CleanupThresholdHours,
} from "../../../../stores/agentCleanup";
import type { AgentSessionView } from "../../../../types";

function useThresholdLabel(): (hours: CleanupThresholdHours) => string {
	const { t } = useLingui();
	return (hours) => {
		if (hours % 24 === 0) {
			const days = hours / 24;
			return t({ message: plural(days, { one: "# day", other: "# days" }) });
		}
		return t({ message: `${hours} h` });
	};
}

/**
 * The cleanup rule as one sentence the user can edit, with what it would
 * free right now. Built to take an "apply automatically" switch later.
 */
export function CleanupBar({
	thresholdHours,
	onThresholdChange,
	candidates,
	disabled,
	onCleanUp,
}: {
	thresholdHours: CleanupThresholdHours;
	onThresholdChange: (hours: CleanupThresholdHours) => void;
	candidates: AgentSessionView[];
	disabled: boolean;
	onCleanUp: () => void;
}) {
	const { t } = useLingui();
	const thresholdLabel = useThresholdLabel();
	const count = candidates.length;
	const freed = formatMemory(
		candidates.reduce((sum, session) => sum + session.memory, 0),
	);
	const threshold = thresholdLabel(thresholdHours);

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b bg-muted/20 px-3 py-2 text-[12px]">
			<LuSparkles className="size-3.5 shrink-0 text-muted-foreground" />
			<span className="text-muted-foreground">
				<Trans>Idle agents I haven't answered for</Trans>
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex h-6 items-center gap-1 rounded border bg-background px-1.5 font-medium transition-colors hover:bg-foreground/[0.06]"
						aria-label={t({ message: "Change how long without an answer" })}
					>
						{threshold}
						<HiOutlineChevronDown className="size-3 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-32">
					<DropdownMenuRadioGroup
						value={String(thresholdHours)}
						onValueChange={(value) =>
							onThresholdChange(Number(value) as CleanupThresholdHours)
						}
					>
						{CLEANUP_THRESHOLD_HOURS.map((hours) => (
							<DropdownMenuRadioItem key={hours} value={String(hours)}>
								{thresholdLabel(hours)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<span className="text-muted-foreground">
				{count === 0 ? (
					<Trans>· none right now</Trans>
				) : (
					t({
						message: plural(count, {
							one: `· # session, ${freed}`,
							other: `· # sessions, ${freed}`,
						}),
					})
				)}
			</span>
			<Button
				size="sm"
				variant={count > 0 ? "default" : "outline"}
				className="ml-auto h-6 px-2.5 text-[11px]"
				disabled={count === 0 || disabled}
				onClick={onCleanUp}
			>
				{t({
					message: plural(count, {
						one: "Close # session…",
						other: "Close # sessions…",
					}),
				})}
			</Button>
		</div>
	);
}

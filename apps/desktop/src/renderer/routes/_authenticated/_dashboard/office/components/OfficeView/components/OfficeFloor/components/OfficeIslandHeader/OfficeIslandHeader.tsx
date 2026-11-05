import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { CSSProperties } from "react";
import {
	LABEL_DOT_CLASS,
	type WorkspaceLabel,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import type { IslandCounts } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

const MAX_LABELS = 3;

/** An island's group name in its color, its labels, and who needs you. */
export function OfficeIslandHeader({
	name,
	color,
	labels,
	workspaceNames,
	counts,
	style,
}: {
	name: string;
	color: string | null;
	labels: WorkspaceLabel[];
	workspaceNames: string[];
	counts: IslandCounts;
	style: CSSProperties;
}) {
	const { t } = useLingui();
	const shown = labels.slice(0, MAX_LABELS);
	const hidden = labels.length - shown.length;
	const needYou = t({
		message: plural(counts.needYou, {
			one: "# needs you",
			other: "# need you",
		}),
	});
	const working = t`${counts.working} working`;

	return (
		<div
			className="pointer-events-none absolute flex flex-col justify-center gap-0.5 overflow-hidden px-2 font-mono leading-none text-[#f4f1ea]"
			style={style}
			title={workspaceNames.join(", ")}
		>
			<div className="flex min-w-0 items-center gap-1.5">
				<span
					aria-hidden
					className="size-2.5 shrink-0 border border-[#1d1a24]"
					style={{ backgroundColor: color ?? "#5d6275" }}
				/>
				<span className="min-w-0 flex-1 truncate text-[11px] font-bold">
					{name}
				</span>
				<span className="flex shrink-0 items-center gap-1 text-[10px]">
					{counts.needYou > 0 && (
						<span className="bg-amber-400 px-1 font-bold text-[#1d1a24]">
							{needYou}
						</span>
					)}
					{counts.working > 0 && (
						<span className="text-yellow-200">{working}</span>
					)}
					{counts.needYou === 0 && counts.working === 0 && (
						<span className="opacity-70">
							<Trans>idle</Trans>
						</span>
					)}
				</span>
			</div>
			{shown.length > 0 && (
				<div className="flex min-w-0 items-center gap-0.5 pl-4">
					{shown.map((label) => (
						<span
							key={label.id}
							className="flex max-w-24 min-w-0 items-center gap-0.5 rounded-sm bg-[#f4f1ea] px-1 text-[9px] leading-3 text-[#1d1a24]"
						>
							<span
								aria-hidden
								className={cn(
									"size-1.5 shrink-0 rounded-full",
									LABEL_DOT_CLASS[label.color],
								)}
							/>
							<span className="truncate">{label.name}</span>
						</span>
					))}
					{hidden > 0 && <span className="text-[9px]">+{hidden}</span>}
				</div>
			)}
		</div>
	);
}

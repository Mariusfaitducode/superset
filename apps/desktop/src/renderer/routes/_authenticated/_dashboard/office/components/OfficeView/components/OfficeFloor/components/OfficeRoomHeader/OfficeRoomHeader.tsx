import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { CSSProperties } from "react";
import { LuFileText, LuGitPullRequest } from "react-icons/lu";
import type { IslandCounts } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

export interface OfficeRoomProject {
	statusLabel: string | null;
	statusColor: string | null;
	pullRequests: number;
	hasNotion: boolean;
	onOpenDetails: () => void;
}

/**
 * A room's group name in its color, and who in it needs you. Click zooms on
 * the room; a project room also shows its Notion status and opens its PRs
 * and specs.
 */
export function OfficeRoomHeader({
	name,
	color,
	counts,
	project,
	style,
	onFocusRoom,
}: {
	name: string;
	color: string | null;
	counts: IslandCounts;
	/** Set when rooms are projects. */
	project?: OfficeRoomProject | null;
	style: CSSProperties;
	onFocusRoom: () => void;
}) {
	const { t } = useLingui();
	const needYou = t({
		message: plural(counts.needYou, {
			one: "# needs you",
			other: "# need you",
		}),
	});
	const working = t`${counts.working} working`;

	return (
		<div
			className="absolute flex items-center gap-1.5 overflow-hidden px-2 font-mono leading-none text-[#f4f1ea]"
			style={style}
		>
			<button
				type="button"
				onClick={onFocusRoom}
				aria-label={t`Zoom on ${name}`}
				className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch text-left outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span
					aria-hidden
					className="size-2.5 shrink-0 border border-[#1d1a24]"
					style={{ backgroundColor: color ?? "#5d6275" }}
				/>
				<span className="min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-wide">
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
							<Trans>nobody waiting</Trans>
						</span>
					)}
				</span>
			</button>
			{project && (
				<button
					type="button"
					onClick={project.onOpenDetails}
					title={t`Project details: PRs, Notion page and specs`}
					className="flex h-4 shrink-0 items-center gap-1 border border-[#f4f1ea]/40 px-1 text-[10px] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring"
				>
					{project.statusLabel && (
						<span className="flex items-center gap-1">
							<span
								aria-hidden
								className="size-1.5 rounded-full"
								style={{ backgroundColor: project.statusColor ?? "#a1a1aa" }}
							/>
							{project.statusLabel}
						</span>
					)}
					<span className="flex items-center gap-0.5 opacity-80">
						<LuGitPullRequest aria-hidden className="size-2.5" />
						{project.pullRequests}
					</span>
					{project.hasNotion && (
						<LuFileText aria-hidden className="size-2.5 opacity-80" />
					)}
				</button>
			)}
		</div>
	);
}

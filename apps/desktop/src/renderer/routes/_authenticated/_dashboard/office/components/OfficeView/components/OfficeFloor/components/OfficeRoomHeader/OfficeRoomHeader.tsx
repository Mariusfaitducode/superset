import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { CSSProperties } from "react";
import type { IslandCounts } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

/** A room's group name in its color, and who in it needs you. Click zooms on the room. */
export function OfficeRoomHeader({
	name,
	color,
	counts,
	style,
	onFocusRoom,
}: {
	name: string;
	color: string | null;
	counts: IslandCounts;
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
		<button
			type="button"
			onClick={onFocusRoom}
			aria-label={t`Zoom on ${name}`}
			className="absolute flex flex-col justify-center overflow-hidden px-2 text-left font-mono leading-none text-[#f4f1ea] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring"
			style={style}
		>
			<div className="flex min-w-0 items-center gap-1.5">
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
							<Trans>idle</Trans>
						</span>
					)}
				</span>
			</div>
		</button>
	);
}

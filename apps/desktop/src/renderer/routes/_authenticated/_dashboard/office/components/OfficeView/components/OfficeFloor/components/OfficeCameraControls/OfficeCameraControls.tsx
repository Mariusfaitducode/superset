import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import type { ReactNode } from "react";
import { LuMaximize, LuMinus, LuPlus } from "react-icons/lu";

function ControlButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					onClick={onClick}
					className="flex size-7 items-center justify-center text-[#f4f1ea] hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="left">{label}</TooltipContent>
		</Tooltip>
	);
}

/** Zoom and "see the whole building", over the office's corner. */
export function OfficeCameraControls({
	zoom,
	onZoomIn,
	onZoomOut,
	onFit,
}: {
	zoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onFit: () => void;
}) {
	const { t } = useLingui();
	return (
		<div className="absolute right-3 bottom-3 flex flex-col items-stretch border-2 border-[#1d1a24] bg-[#2d2a3a]/90 shadow-[2px_2px_0_rgba(29,26,36,0.45)]">
			<ControlButton label={t`Zoom in (+)`} onClick={onZoomIn}>
				<LuPlus className="size-3.5" />
			</ControlButton>
			<span className="border-y border-[#1d1a24] py-0.5 text-center font-mono text-[10px] text-[#f4f1ea]/80 tabular-nums">
				{Math.round(zoom * 100)}%
			</span>
			<ControlButton label={t`Zoom out (−)`} onClick={onZoomOut}>
				<LuMinus className="size-3.5" />
			</ControlButton>
			<ControlButton label={t`See the whole building (0)`} onClick={onFit}>
				<LuMaximize className="size-3.5" />
			</ControlButton>
		</div>
	);
}

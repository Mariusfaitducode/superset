import { Trans } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import type { CSSProperties } from "react";

/** A subagent or workflow agent drawn on the canvas: click opens its transcript. */
export function OfficeHelperButton({
	label,
	description,
	parentTitle,
	style,
	onOpen,
}: {
	label: string;
	description: string | null;
	parentTitle: string;
	style: CSSProperties;
	onOpen: () => void;
}) {
	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onOpen}
					aria-label={`${label} · ${parentTitle}`}
					style={style}
					className="absolute rounded-sm outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-ring"
				/>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-72">
				<p className="font-medium">{label}</p>
				{description && <p className="line-clamp-3">{description}</p>}
				<p className="opacity-70">
					<Trans>Working for {parentTitle}</Trans>
				</p>
				<p className="mt-1 opacity-60">
					<Trans>Click to open its transcript</Trans>
				</p>
			</TooltipContent>
		</Tooltip>
	);
}

import { cn } from "@superset/ui/utils";

const SIZE = 14;
const STROKE = 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The tasks' overall progress as a ring. Null spins a short arc: something
 * runs but says nothing measurable.
 */
export function ProgressRing({
	progress,
	className,
}: {
	progress: number | null;
	className?: string;
}) {
	const fraction =
		progress === null ? 0.25 : Math.min(1, Math.max(0, progress));
	return (
		<svg
			width={SIZE}
			height={SIZE}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			aria-hidden="true"
			className={cn(
				"shrink-0 -rotate-90",
				progress === null && "motion-safe:animate-spin",
				className,
			)}
		>
			<circle
				cx={SIZE / 2}
				cy={SIZE / 2}
				r={RADIUS}
				fill="none"
				strokeWidth={STROKE}
				className="stroke-current opacity-20"
			/>
			<circle
				cx={SIZE / 2}
				cy={SIZE / 2}
				r={RADIUS}
				fill="none"
				strokeWidth={STROKE}
				strokeLinecap="round"
				strokeDasharray={CIRCUMFERENCE}
				strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
				className="stroke-current transition-[stroke-dashoffset] duration-500 ease-out"
			/>
		</svg>
	);
}

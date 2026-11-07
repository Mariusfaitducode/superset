import { memo } from "react";
import type { GraphRowLayout } from "../../utils/layoutGitGraph";

export const GRAPH_ROW_HEIGHT = 26;
export const GRAPH_LANE_WIDTH = 12;
const NODE_RADIUS = 3.5;

// Readable on light and dark backgrounds; a lane keeps its color down the graph.
const LANE_COLORS = [
	"#e5489c",
	"#2bb24c",
	"#9b51e0",
	"#e8890c",
	"#13b5c8",
	"#e5534b",
	"#3b82f6",
	"#84cc16",
	"#d946ef",
	"#f59e0b",
];

export function laneColor(color: number): string {
	return LANE_COLORS[color % LANE_COLORS.length] as string;
}

function x(lane: number): number {
	return lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2;
}

/** One row of the graph: lines crossing it, into its node, and out to the parents. */
export const GitGraphCell = memo(function GitGraphCell({
	row,
	width,
	isMerge,
	isDimmed,
}: {
	row: GraphRowLayout;
	width: number;
	isMerge: boolean;
	isDimmed: boolean;
}) {
	const height = GRAPH_ROW_HEIGHT;
	const mid = height / 2;
	const nodeX = x(row.lane);
	return (
		<svg
			width={width}
			height={height}
			className="shrink-0 overflow-visible"
			aria-hidden="true"
			style={{ opacity: isDimmed ? 0.35 : 1 }}
		>
			{row.passing.map((line) => (
				<line
					key={`p${line.lane}`}
					x1={x(line.lane)}
					y1={0}
					x2={x(line.lane)}
					y2={height}
					stroke={laneColor(line.color)}
					strokeWidth={2}
				/>
			))}
			{row.incoming.map((line) => (
				<path
					key={`i${line.from}`}
					d={
						line.from === row.lane
							? `M ${nodeX} 0 L ${nodeX} ${mid}`
							: `M ${x(line.from)} 0 C ${x(line.from)} ${mid * 0.8}, ${nodeX} ${mid * 0.2}, ${nodeX} ${mid}`
					}
					fill="none"
					stroke={laneColor(line.color)}
					strokeWidth={2}
				/>
			))}
			{row.outgoing.map((line) => (
				<path
					key={`o${line.to}`}
					d={
						line.to === row.lane
							? `M ${nodeX} ${mid} L ${nodeX} ${height}`
							: `M ${nodeX} ${mid} C ${nodeX} ${mid + mid * 0.8}, ${x(line.to)} ${mid + mid * 0.2}, ${x(line.to)} ${height}`
					}
					fill="none"
					stroke={laneColor(line.color)}
					strokeWidth={2}
				/>
			))}
			<circle
				cx={nodeX}
				cy={mid}
				r={NODE_RADIUS}
				fill={isMerge ? "var(--background)" : laneColor(row.color)}
				stroke={laneColor(row.color)}
				strokeWidth={2}
			/>
		</svg>
	);
});

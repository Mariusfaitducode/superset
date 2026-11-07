import { memo } from "react";
import type { GraphRowLayout } from "../../utils/layoutGitGraph";

export const GRAPH_ROW_HEIGHT = 24;
export const GRAPH_LANE_WIDTH = 16;
const NODE_RADIUS = 4;
const STROKE_WIDTH = 2;
const DASHED_COLOR = "var(--muted-foreground)";

// The Git Graph extension's default palette; a lane keeps its color down the graph.
const LANE_COLORS = [
	"#0085d9",
	"#d9008f",
	"#00d90a",
	"#d98500",
	"#a300d9",
	"#ff0000",
	"#00d9cc",
	"#e138e8",
	"#85d900",
	"#dc5b23",
	"#6f24d6",
	"#ffcc00",
];

export function laneColor(color: number): string {
	return LANE_COLORS[color % LANE_COLORS.length] as string;
}

function x(lane: number): number {
	return lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2;
}

function strokeOf(line: { color: number; dashed?: boolean }) {
	return line.dashed
		? { stroke: DASHED_COLOR, strokeDasharray: "3 3" }
		: { stroke: laneColor(line.color) };
}

/** The HEAD commit and the uncommitted changes are hollow, as in Git Graph. */
export type GraphNodeKind = "commit" | "head" | "uncommitted";

/** One row of the graph: lines crossing it, into its node, and out to the parents. */
export const GitGraphCell = memo(function GitGraphCell({
	row,
	width,
	node,
	isDimmed,
}: {
	row: GraphRowLayout;
	width: number;
	node: GraphNodeKind;
	isDimmed: boolean;
}) {
	const height = GRAPH_ROW_HEIGHT;
	const mid = height / 2;
	const nodeX = x(row.lane);
	const nodeColor =
		node === "uncommitted" ? DASHED_COLOR : laneColor(row.color);
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
					strokeWidth={STROKE_WIDTH}
					{...strokeOf(line)}
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
					strokeWidth={STROKE_WIDTH}
					{...strokeOf(line)}
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
					strokeWidth={STROKE_WIDTH}
					{...strokeOf(line)}
				/>
			))}
			<circle
				cx={nodeX}
				cy={mid}
				r={NODE_RADIUS}
				fill={node === "commit" ? nodeColor : "var(--background)"}
				stroke={nodeColor}
				strokeWidth={STROKE_WIDTH}
			/>
		</svg>
	);
});

/** The lanes that continue past a row, drawn beside its open details. */
export function GitGraphContinuation({
	row,
	width,
	height,
}: {
	row: GraphRowLayout;
	width: number;
	height: number;
}) {
	const lines = [
		...row.passing,
		...row.outgoing.map((line) => ({ ...line, lane: line.to })),
	];
	return (
		<svg width={width} height={height} className="shrink-0" aria-hidden="true">
			{lines.map((line, index) => (
				<line
					// A merge's line can end in a lane another line already uses.
					key={`${line.lane}-${index}`}
					x1={x(line.lane)}
					y1={0}
					x2={x(line.lane)}
					y2={height}
					strokeWidth={STROKE_WIDTH}
					{...strokeOf(line)}
				/>
			))}
		</svg>
	);
}

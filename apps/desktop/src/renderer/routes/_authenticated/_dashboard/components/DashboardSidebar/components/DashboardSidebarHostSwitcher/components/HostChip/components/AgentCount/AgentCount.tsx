import { AgentStateDot } from "renderer/components/AgentStateDot";

export function AgentCount({
	state,
	count,
}: {
	state: "working" | "needsYou" | "idle";
	count: number;
}) {
	if (count === 0) return null;
	return (
		<span className="flex shrink-0 items-center gap-0.5 tabular-nums">
			<AgentStateDot state={state} />
			{count}
		</span>
	);
}

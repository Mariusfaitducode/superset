import { cn } from "@superset/ui/utils";
import {
	AGENT_STATE_DOT_CLASS,
	type AgentState,
	isBlockedOnUser,
} from "renderer/lib/agent-state";

/** One agent state as a dot; it pings while the agent waits on the user. */
export function AgentStateDot({
	state,
	className,
}: {
	state: AgentState;
	className?: string;
}) {
	return (
		<span
			className={cn("relative flex size-1.5 shrink-0", className)}
			data-agent-state={state}
		>
			{isBlockedOnUser(state) && (
				<span
					className={cn(
						"absolute inline-flex size-full animate-ping rounded-full opacity-75",
						AGENT_STATE_DOT_CLASS[state],
					)}
				/>
			)}
			<span
				className={cn(
					"relative inline-flex size-full rounded-full",
					AGENT_STATE_DOT_CLASS[state],
				)}
			/>
		</span>
	);
}

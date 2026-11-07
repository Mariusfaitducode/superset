import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useEffect, useState } from "react";
import { LuSquare } from "react-icons/lu";
import {
	AGENT_STATE_LABEL,
	AgentStateDot,
} from "renderer/components/AgentStateDot";
import type { HostAgentView } from "../../../../../../../utils/groupHostAgents";

const CONFIRM_STOP_MS = 3_000;

interface AgentRowProps {
	agent: HostAgentView;
	disabled: boolean;
	onOpen: () => void;
	onStop: () => Promise<void>;
}

/** One live agent: click to open its conversation; Stop asks twice. */
export function AgentRow({ agent, disabled, onOpen, onStop }: AgentRowProps) {
	const { t, i18n } = useLingui();
	const [confirming, setConfirming] = useState(false);
	const [stopping, setStopping] = useState(false);
	useEffect(() => {
		if (!confirming) return;
		const timer = setTimeout(() => setConfirming(false), CONFIRM_STOP_MS);
		return () => clearTimeout(timer);
	}, [confirming]);

	const stateLabel = i18n._(AGENT_STATE_LABEL[agent.state]);
	const subagentCount = agent.subagentCount;

	return (
		<div className="group/agent flex h-8 items-center gap-2 rounded-md pr-1 pl-2 hover:bg-muted/60">
			<button
				type="button"
				onClick={onOpen}
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
				title={t({ message: "Open the conversation" })}
			>
				<AgentStateDot state={agent.state} />
				<span className="shrink-0 font-mono text-muted-foreground text-xs">
					{agent.agentId}
				</span>
				<span className="truncate text-sm">{agent.title ?? stateLabel}</span>
				{subagentCount > 0 && (
					<span className="shrink-0 text-muted-foreground text-xs">
						{t({ message: `+${subagentCount} subagents` })}
					</span>
				)}
			</button>
			<span className="shrink-0 text-muted-foreground text-xs">
				{stateLabel}
			</span>
			<span className="w-10 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
				{formatCompactRelativeTime(agent.lastEventAt)}
			</span>
			<Button
				size="sm"
				variant={confirming ? "destructive" : "ghost"}
				disabled={disabled || stopping}
				className={cn(
					"h-6 gap-1 px-2 text-xs",
					!confirming &&
						"opacity-0 group-hover/agent:opacity-100 focus-visible:opacity-100",
				)}
				onClick={async () => {
					if (!confirming) {
						setConfirming(true);
						return;
					}
					setConfirming(false);
					setStopping(true);
					try {
						await onStop();
					} finally {
						setStopping(false);
					}
				}}
			>
				<LuSquare className="size-3" />
				{confirming ? t({ message: "Confirm stop" }) : t({ message: "Stop" })}
			</Button>
		</div>
	);
}

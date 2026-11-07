import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { LuPlus, LuSquareTerminal } from "react-icons/lu";

interface NewAgentMenuProps {
	agents: ReadonlyArray<{ id: string; label: string }>;
	disabled: boolean;
	onStartAgent: (agentConfigId: string) => void;
	onOpenTerminal: () => void;
}

/** Starts one of the host's agents, or a plain terminal, in a workspace. */
export function NewAgentMenu({
	agents,
	disabled,
	onStartAgent,
	onOpenTerminal,
}: NewAgentMenuProps) {
	const { t } = useLingui();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant="ghost"
					disabled={disabled}
					className="h-6 gap-1 px-2 text-xs"
					aria-label={t({ message: "New agent or terminal" })}
				>
					<LuPlus className="size-3" />
					<Trans>New</Trans>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{agents.map((agent) => (
					<DropdownMenuItem
						key={agent.id}
						onSelect={() => onStartAgent(agent.id)}
					>
						{agent.label}
					</DropdownMenuItem>
				))}
				{agents.length === 0 && (
					<DropdownMenuItem disabled>
						<Trans>No agent is configured on this host</Trans>
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onOpenTerminal}>
					<LuSquareTerminal className="size-3.5" />
					<Trans>Terminal</Trans>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

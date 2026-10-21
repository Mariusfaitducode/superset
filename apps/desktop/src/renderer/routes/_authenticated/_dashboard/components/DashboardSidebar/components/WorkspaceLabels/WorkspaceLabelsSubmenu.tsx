import { Trans, useLingui } from "@lingui/react/macro";
import {
	ContextMenuCheckboxItem,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@superset/ui/context-menu";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { LuSettings2, LuTag } from "react-icons/lu";
import { LABEL_DOT_CLASS } from "./labels";
import { useHostLabels } from "./useWorkspaceLabels";

/** Context-menu entry to toggle the workspace's labels. */
export function WorkspaceLabelsSubmenu({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const { state, actions } = useHostLabels(hostId);
	if (!state) return null;
	const current = state.assignments[workspaceId] ?? [];

	const toggle = (labelId: string, checked: boolean) => {
		const next = checked
			? [...current, labelId]
			: current.filter((id) => id !== labelId);
		actions
			.setWorkspaceLabels(workspaceId, next)
			.catch(() => toast.error(t`Could not change the labels`));
	};

	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger>
				<LuTag className="size-4 mr-2" />
				<Trans>Labels</Trans>
			</ContextMenuSubTrigger>
			<ContextMenuSubContent>
				{state.labels.map((label) => (
					<ContextMenuCheckboxItem
						key={label.id}
						checked={current.includes(label.id)}
						onCheckedChange={(checked) => toggle(label.id, checked === true)}
						onSelect={(event) => event.preventDefault()}
					>
						<span
							className={cn(
								"size-2 shrink-0 rounded-full mr-2",
								LABEL_DOT_CLASS[label.color],
							)}
						/>
						{label.name}
					</ContextMenuCheckboxItem>
				))}
				<ContextMenuSeparator />
				<ContextMenuItem
					onSelect={() => void navigate({ to: "/settings/sidebar" })}
				>
					<LuSettings2 className="size-4 mr-2" />
					<Trans>Manage labels…</Trans>
				</ContextMenuItem>
			</ContextMenuSubContent>
		</ContextMenuSub>
	);
}

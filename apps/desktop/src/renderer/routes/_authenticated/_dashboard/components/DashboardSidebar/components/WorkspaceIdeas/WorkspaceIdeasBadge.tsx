import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuLightbulb } from "react-icons/lu";
import {
	useIsWorkspaceIdeasOpen,
	useWorkspaceIdeasPanelStore,
} from "renderer/stores/workspace-ideas-panel";
import { useWorkspaceIdeas } from "./useWorkspaceIdeas";

/**
 * The workspace's open ideas on its row; opens the ideas under it. With no
 * open idea it only shows while the row is hovered, so a list can be started.
 */
export function WorkspaceIdeasBadge({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const { t } = useLingui();
	const { ideas, activeCount } = useWorkspaceIdeas(workspaceId, hostId);
	const isOpen = useIsWorkspaceIdeasOpen(workspaceId);
	if (ideas === null) return null;

	return (
		<button
			type="button"
			aria-expanded={isOpen}
			aria-label={t`Ideas: ${activeCount} open`}
			title={t`Ideas: ${activeCount} open`}
			onClick={(event) => {
				event.stopPropagation();
				useWorkspaceIdeasPanelStore.getState().toggle(workspaceId);
			}}
			onMouseDown={(event) => event.stopPropagation()}
			onTouchStart={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.stopPropagation();
				}
			}}
			className={cn(
				"flex h-4 shrink-0 items-center gap-0.5 rounded-sm px-0.5 text-[10px] tabular-nums text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
				isOpen && "text-foreground",
				activeCount === 0 &&
					!isOpen &&
					"hidden group-hover:flex group-focus-within:flex",
			)}
		>
			<LuLightbulb className="size-3" />
			{activeCount > 0 && <span>{activeCount}</span>}
		</button>
	);
}

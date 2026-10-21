import { cn } from "@superset/ui/utils";
import { LABEL_PILL_CLASS, workspaceLabels } from "./labels";
import { useHostLabels } from "./useWorkspaceLabels";

const MAX_SHOWN = 2;

/** The workspace's labels on its row; past two, a count with all on hover. */
export function WorkspaceLabelPills({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const { state } = useHostLabels(hostId);
	const labels = workspaceLabels(state, workspaceId);
	if (labels.length === 0) return null;
	const shown = labels.slice(0, MAX_SHOWN);
	const hidden = labels.length - shown.length;

	return (
		<span
			className="flex min-w-0 shrink items-center gap-0.5"
			title={labels.map((label) => label.name).join(", ")}
		>
			{shown.map((label) => (
				<span
					key={label.id}
					className={cn(
						"max-w-20 truncate rounded px-1 text-[10px] leading-4",
						LABEL_PILL_CLASS[label.color],
					)}
				>
					{label.name}
				</span>
			))}
			{hidden > 0 && (
				<span className="text-[10px] text-muted-foreground">+{hidden}</span>
			)}
		</span>
	);
}

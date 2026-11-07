import { cn } from "@superset/ui/utils";
import { LABEL_PILL_CLASS, workspaceLabels } from "./labels";
import { useHostLabels } from "./useWorkspaceLabels";

const MAX_SHOWN = 2;

/**
 * The workspace's labels. Past two, a count with all on hover; with `all`,
 * every label, wrapping when they don't fit, the first one never cut.
 */
export function WorkspaceLabelPills({
	workspaceId,
	hostId,
	all = false,
}: {
	workspaceId: string;
	hostId: string;
	all?: boolean;
}) {
	const { state } = useHostLabels(hostId);
	const labels = workspaceLabels(state, workspaceId);
	if (labels.length === 0) return null;
	const shown = all ? labels : labels.slice(0, MAX_SHOWN);
	const hidden = labels.length - shown.length;

	return (
		<span
			className={cn(
				"flex min-w-0 shrink items-center gap-0.5",
				all && "flex-wrap justify-end gap-y-0.5",
			)}
			title={labels.map((label) => label.name).join(", ")}
		>
			{shown.map((label, index) => (
				<span
					key={label.id}
					className={cn(
						"truncate rounded px-1 text-[10px] leading-4",
						all ? (index === 0 ? "shrink-0" : "max-w-24") : "max-w-20",
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

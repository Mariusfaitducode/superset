import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuX } from "react-icons/lu";
import { useWorkspaceLabelFilterStore } from "renderer/stores/workspace-label-filter";
import { LABEL_DOT_CLASS, type WorkspaceLabel } from "./labels";

/**
 * Click labels to keep only the workspaces that have all of them. Shows the
 * labels of every host in view, merged by name.
 */
export function WorkspaceLabelFilterBar({
	labels,
}: {
	labels: WorkspaceLabel[];
}) {
	const { t } = useLingui();
	const selected = useWorkspaceLabelFilterStore((state) => state.selected);
	const toggle = useWorkspaceLabelFilterStore((state) => state.toggle);
	const clear = useWorkspaceLabelFilterStore((state) => state.clear);
	if (labels.length === 0) return null;
	const isOn = (label: WorkspaceLabel) =>
		selected.some((name) => name.toLowerCase() === label.name.toLowerCase());

	return (
		<div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
			{labels.map((label) => (
				<button
					key={label.name.toLowerCase()}
					type="button"
					aria-pressed={isOn(label)}
					onClick={() => toggle(label.name)}
					className={cn(
						"flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] transition-colors",
						isOn(label)
							? "border-foreground/40 bg-accent text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							LABEL_DOT_CLASS[label.color],
						)}
					/>
					{label.name}
				</button>
			))}
			{selected.length > 0 && (
				<button
					type="button"
					onClick={clear}
					aria-label={t`Clear label filter`}
					className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<LuX className="size-3" />
				</button>
			)}
		</div>
	);
}

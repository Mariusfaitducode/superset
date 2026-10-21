import { Trans } from "@lingui/react/macro";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import { LuTag } from "react-icons/lu";
import { LABEL_DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import { useWorkspacesLabelViewStore } from "../../stores/workspacesLabelView";
import { useWorkspacesLabels } from "./WorkspacesLabelsProvider";

/** The Filter menu's Labels entry: keeps workspaces with every checked label. */
export function WorkspacesLabelFilterSubmenu() {
	const { labels, activeFilters } = useWorkspacesLabels();
	const toggle = useWorkspacesLabelViewStore(
		(state) => state.toggleLabelFilter,
	);
	if (labels.length === 0) return null;
	const isOn = (name: string) =>
		activeFilters.some((item) => item.toLowerCase() === name.toLowerCase());

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<span className="flex items-center gap-2">
					<LuTag className="size-3.5" />
					<Trans>Labels</Trans>
				</span>
				{activeFilters.length > 0 ? (
					<span className="ml-auto max-w-32 truncate pl-3 text-xs text-muted-foreground">
						{activeFilters.join(", ")}
					</span>
				) : null}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="min-w-0">
				{labels.map((label) => (
					<DropdownMenuCheckboxItem
						indicator="end"
						key={label.name.toLowerCase()}
						checked={isOn(label.name)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={() => toggle(label.name)}
					>
						<span className="flex items-center gap-2">
							<span
								className={cn(
									"size-2 rounded-full",
									LABEL_DOT_CLASS[label.color],
								)}
							/>
							{label.name}
						</span>
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

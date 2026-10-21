import { Trans } from "@lingui/react/macro";
import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@superset/ui/dropdown-menu";
import {
	useWorkspacesLabelViewStore,
	type WorkspacesGroupBy,
} from "../../stores/workspacesLabelView";

/** Display menu entry: board columns by status (default) or by label. */
export function WorkspacesGroupByMenu() {
	const groupBy = useWorkspacesLabelViewStore((state) => state.groupBy);
	const setGroupBy = useWorkspacesLabelViewStore((state) => state.setGroupBy);
	return (
		<>
			<DropdownMenuSeparator />
			<DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
				<Trans>Columns</Trans>
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				value={groupBy}
				onValueChange={(next) => setGroupBy(next as WorkspacesGroupBy)}
			>
				<DropdownMenuRadioItem value="status">
					<Trans>By status</Trans>
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="label">
					<Trans>By label</Trans>
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
		</>
	);
}

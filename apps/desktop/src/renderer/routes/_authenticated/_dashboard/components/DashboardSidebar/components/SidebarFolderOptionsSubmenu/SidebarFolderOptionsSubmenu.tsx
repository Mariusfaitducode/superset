import { Trans, useLingui } from "@lingui/react/macro";
import {
	ContextMenuCheckboxItem,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@superset/ui/context-menu";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@superset/ui/dropdown-menu";
import { LuSlidersHorizontal } from "react-icons/lu";
import {
	type FolderOptionKey,
	type FolderRef,
	folderKey,
	useSidebarFolderOptionsStore,
} from "renderer/stores/sidebar-folder-options";

interface SidebarFolderOptionsSubmenuProps {
	folder: FolderRef;
	kind: "context" | "dropdown";
}

/** What the sidebar shows under the rows of one project or group. */
export function SidebarFolderOptionsSubmenu({
	folder,
	kind,
}: SidebarFolderOptionsSubmenuProps) {
	const { t } = useLingui();
	const options = useSidebarFolderOptionsStore(
		(state) => state.byFolder[folderKey(folder)],
	);
	const setOption = useSidebarFolderOptionsStore((state) => state.setOption);
	const items: { key: FolderOptionKey; label: string }[] = [
		{ key: "hideConversations", label: t`Hide conversations` },
		{ key: "hideIdleConversations", label: t`Hide idle conversations` },
		{ key: "hideSubagents", label: t`Hide subagents` },
		{ key: "hideTodos", label: t`Hide to-dos` },
		{ key: "compactRows", label: t`Compact conversations` },
	];
	const iconClassName = kind === "context" ? "size-4 mr-2" : "size-4";
	const trigger = (
		<>
			<LuSlidersHorizontal className={iconClassName} />
			<Trans>Sidebar options</Trans>
		</>
	);

	const checkboxes = items.map((item) => {
		const checked = options?.[item.key] === true;
		const onCheckedChange = (value: boolean) =>
			setOption(folder, item.key, value);
		return kind === "context" ? (
			<ContextMenuCheckboxItem
				key={item.key}
				checked={checked}
				onCheckedChange={onCheckedChange}
				onSelect={(event) => event.preventDefault()}
			>
				{item.label}
			</ContextMenuCheckboxItem>
		) : (
			<DropdownMenuCheckboxItem
				key={item.key}
				checked={checked}
				onCheckedChange={onCheckedChange}
				onSelect={(event) => event.preventDefault()}
			>
				{item.label}
			</DropdownMenuCheckboxItem>
		);
	});

	return kind === "context" ? (
		<ContextMenuSub>
			<ContextMenuSubTrigger>{trigger}</ContextMenuSubTrigger>
			<ContextMenuSubContent className="w-56">
				{checkboxes}
			</ContextMenuSubContent>
		</ContextMenuSub>
	) : (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>{trigger}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-56">
				{checkboxes}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

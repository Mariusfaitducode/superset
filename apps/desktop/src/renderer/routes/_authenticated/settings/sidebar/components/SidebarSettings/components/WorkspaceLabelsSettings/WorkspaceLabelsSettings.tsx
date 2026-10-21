import { Trans, useLingui } from "@lingui/react/macro";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { type KeyboardEvent, useState } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import {
	LABEL_COLORS,
	LABEL_DOT_CLASS,
	type LabelColor,
	type WorkspaceLabel,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import { useHostLabels } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/useWorkspaceLabels";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";

function ColorPicker({
	color,
	onChange,
}: {
	color: LabelColor;
	onChange: (color: LabelColor) => void;
}) {
	const { t } = useLingui();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={t`Label color`}
				className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-accent"
			>
				<span className={cn("size-3 rounded-full", LABEL_DOT_CLASS[color])} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="grid grid-cols-5 gap-1 p-1.5"
			>
				{LABEL_COLORS.map((item) => (
					<DropdownMenuItem
						key={item}
						onSelect={() => onChange(item)}
						className="flex size-6 items-center justify-center p-0"
					>
						<span
							className={cn(
								"size-3 rounded-full",
								LABEL_DOT_CLASS[item],
								item === color && "ring-2 ring-ring ring-offset-1",
							)}
						/>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function LabelRow({
	label,
	onUpdate,
	onDelete,
}: {
	label: WorkspaceLabel;
	onUpdate: (fields: { name?: string; color?: LabelColor }) => void;
	onDelete: () => void;
}) {
	const { t } = useLingui();
	const [name, setName] = useState(label.name);
	const commit = () => {
		const trimmed = name.trim();
		if (!trimmed) return setName(label.name);
		if (trimmed !== label.name) onUpdate({ name: trimmed });
	};
	return (
		<li className="group flex items-center gap-2 py-1">
			<ColorPicker
				color={label.color}
				onChange={(color) => onUpdate({ color })}
			/>
			<input
				value={name}
				aria-label={t`Label name`}
				maxLength={40}
				onChange={(event) => setName(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
					if (event.key === "Escape") setName(label.name);
				}}
				className="h-7 min-w-0 flex-1 rounded-sm bg-transparent px-1.5 text-sm outline-none hover:bg-accent/50 focus:bg-background focus:ring-1 focus:ring-ring"
			/>
			<button
				type="button"
				aria-label={t`Delete label`}
				onClick={onDelete}
				className="rounded-sm p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
			>
				<LuTrash2 className="size-3.5" />
			</button>
		</li>
	);
}

/** Create, rename, recolor and delete the labels of this machine's workspaces. */
export function WorkspaceLabelsSettings() {
	const { t } = useLingui();
	const { machineId } = useLocalHostService();
	const { state, actions } = useHostLabels(machineId);
	const [name, setName] = useState("");
	const [color, setColor] = useState<LabelColor>("gray");
	const failed = (error: unknown) =>
		toast.error(t`Could not change the labels`, {
			description: error instanceof Error ? error.message : undefined,
		});

	if (!state) return null;

	const add = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		actions
			.createLabel({ name: trimmed, color })
			.then(() => setName(""))
			.catch(failed);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" && !event.nativeEvent.isComposing) add();
	};

	return (
		<section className="mt-10">
			<h3 className="text-sm font-semibold">
				<Trans>Workspace labels</Trans>
			</h3>
			<p className="mt-0.5 mb-3 text-xs text-muted-foreground">
				<Trans>
					Put them on a workspace from its right-click menu, then filter the
					sidebar by clicking them under Workspaces. Agents can set them too.
				</Trans>
			</p>
			<ul className="divide-y divide-border">
				{state.labels.map((label) => (
					<LabelRow
						key={label.id}
						label={label}
						onUpdate={(fields) =>
							actions.updateLabel({ id: label.id, ...fields }).catch(failed)
						}
						onDelete={() => actions.deleteLabel(label.id).catch(failed)}
					/>
				))}
			</ul>
			<div className="mt-2 flex items-center gap-2">
				<ColorPicker color={color} onChange={setColor} />
				<input
					value={name}
					placeholder={t`New label…`}
					maxLength={40}
					onChange={(event) => setName(event.target.value)}
					onKeyDown={onKeyDown}
					className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-transparent px-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
				/>
				<button
					type="button"
					onClick={add}
					disabled={!name.trim()}
					aria-label={t`Add label`}
					className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
				>
					<LuPlus className="size-4" />
				</button>
			</div>
		</section>
	);
}

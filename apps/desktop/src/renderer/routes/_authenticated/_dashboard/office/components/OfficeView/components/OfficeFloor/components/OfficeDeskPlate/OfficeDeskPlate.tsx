import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { CSSProperties } from "react";
import { LuUser } from "react-icons/lu";
import { WorkspaceFocusToggle } from "renderer/components/WorkspaceFocus";
import {
	LABEL_DOT_CLASS,
	type WorkspaceLabel,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";
import { useIsWorkspaceFocused } from "renderer/stores/workspace-focus";
import {
	TONE_EDGE_CLASS,
	TONE_GLYPH,
	TONE_GLYPH_CLASS,
} from "../../toneStyles";

const MAX_LABELS = 2;

/**
 * A workspace's name plate on its cubicle: name, state of its most urgent
 * chat, branch and labels. Click opens the workspace; the target on its
 * corner puts it in focus.
 */
export function OfficeDeskPlate({
	workspaceId,
	name,
	branch,
	labels,
	tone,
	toneLabel,
	chats,
	style,
	onOpen,
}: {
	workspaceId: string;
	name: string;
	/** Shown under the name when it says something the name does not. */
	branch: string | null;
	labels: WorkspaceLabel[];
	/** Null when no chat runs here. */
	tone: OfficeTone | null;
	toneLabel: string;
	chats: number;
	style: CSSProperties;
	onOpen: () => void;
}) {
	const { t } = useLingui();
	const shown = labels.slice(0, MAX_LABELS);
	const hidden = labels.length - shown.length;
	const details = [name, branch, toneLabel].filter(Boolean).join(" · ");
	const isInFocus = useIsWorkspaceFocused(workspaceId);

	return (
		<div style={style} className="group/plate absolute">
			<button
				type="button"
				onClick={onOpen}
				title={t`Open workspace: ${details}`}
				aria-label={t`Open workspace: ${details}`}
				className={cn(
					"flex size-full min-w-0 flex-col justify-center gap-px overflow-hidden border-2 border-l-4 border-[#1d1a24] bg-[#f4f1ea] px-1 text-left font-mono leading-none text-[#1d1a24] shadow-[2px_2px_0_rgba(29,26,36,0.45)] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-ring",
					tone ? TONE_EDGE_CLASS[tone] : "border-l-zinc-400",
					!tone && !isInFocus && "opacity-70",
					isInFocus &&
						"outline-solid outline-2 outline-offset-1 outline-[color:var(--focus-mark)]",
				)}
			>
				<span className="flex min-w-0 items-center gap-1">
					{tone && (
						<span
							aria-hidden
							className={cn(
								"flex size-3 shrink-0 items-center justify-center text-[10px] font-bold",
								TONE_GLYPH_CLASS[tone],
							)}
						>
							{TONE_GLYPH[tone]}
						</span>
					)}
					<span className="min-w-0 flex-1 truncate text-[11px] font-bold">
						{name}
					</span>
					<span className="flex shrink-0 items-center text-[10px] opacity-70">
						<LuUser aria-hidden className="size-2.5" />
						{chats}
					</span>
				</span>
				{(branch || shown.length > 0) && (
					<span className="flex min-w-0 items-center gap-1 text-[9px]">
						{branch && (
							<span className="min-w-0 shrink truncate opacity-60">
								{branch}
							</span>
						)}
						{shown.map((label) => (
							<span
								key={label.id}
								className="flex max-w-20 min-w-0 shrink-0 items-center gap-0.5 rounded-sm bg-[#1d1a24]/10 px-1 leading-3"
							>
								<span
									aria-hidden
									className={cn(
										"size-1.5 shrink-0 rounded-full",
										LABEL_DOT_CLASS[label.color],
									)}
								/>
								<span className="truncate">{label.name}</span>
							</span>
						))}
						{hidden > 0 && <span className="shrink-0">+{hidden}</span>}
					</span>
				)}
			</button>
			<WorkspaceFocusToggle
				workspaceId={workspaceId}
				className="absolute -top-2 -right-2 size-4 rounded-full border-2 border-[#1d1a24] bg-[#f4f1ea] hover:bg-white"
				idleClassName="hidden text-[#1d1a24] group-hover/plate:flex group-focus-within/plate:flex"
				iconClassName="size-2.5"
			/>
		</div>
	);
}

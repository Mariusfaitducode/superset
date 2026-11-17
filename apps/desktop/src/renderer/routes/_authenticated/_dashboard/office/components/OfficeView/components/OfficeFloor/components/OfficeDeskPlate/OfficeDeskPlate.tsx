import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { CSSProperties } from "react";
import { WorkspaceFocusToggle } from "renderer/components/WorkspaceFocus";
import { WORK_STATES } from "renderer/lib/agent-state";
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
 * A workspace's name plate on its cubicle: name, how many of its chats are
 * in each state (a workspace has no state of its own), branch and labels.
 * Its edge takes the most urgent chat's color. Click opens the workspace;
 * the target on its corner puts it in focus.
 */
export function OfficeDeskPlate({
	workspaceId,
	name,
	branch,
	labels,
	project,
	tone,
	toneLabel,
	tones,
	style,
	onOpen,
}: {
	workspaceId: string;
	name: string;
	/** Shown under the name when it says something the name does not. */
	branch: string | null;
	labels: WorkspaceLabel[];
	/** Its project's name, when rooms do not already say it. */
	project: string | null;
	/** Null when no chat runs here. */
	tone: OfficeTone | null;
	toneLabel: string;
	/** The state of each chat at this desk. */
	tones: readonly OfficeTone[];
	style: CSSProperties;
	onOpen: () => void;
}) {
	const { t } = useLingui();
	const shown = labels.slice(0, MAX_LABELS);
	const hidden = labels.length - shown.length;
	const details = [name, project, branch, toneLabel]
		.filter(Boolean)
		.join(" · ");
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
					<span className="min-w-0 flex-1 truncate text-[11px] font-bold">
						{name}
					</span>
					{WORK_STATES.map((state) => {
						const count = tones.filter((entry) => entry === state).length;
						if (count === 0) return null;
						return (
							<span
								key={state}
								aria-hidden
								className={cn(
									"flex h-3 shrink-0 items-center gap-px px-0.5 text-[9px] font-bold tabular-nums",
									TONE_GLYPH_CLASS[state],
								)}
							>
								{TONE_GLYPH[state]}
								{count > 1 && count}
							</span>
						);
					})}
				</span>
				{(branch || project || shown.length > 0) && (
					<span className="flex min-w-0 items-center gap-1 text-[9px]">
						{project && (
							<span className="max-w-24 min-w-0 shrink-0 truncate font-bold">
								{project}
							</span>
						)}
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

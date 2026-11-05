import { useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import {
	LuCheck,
	LuChevronDown,
	LuChevronRight,
	LuCopy,
	LuSend,
} from "react-icons/lu";
import type { RichTodoFields } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

/**
 * What a to-do carries for the user to act on: who it goes to and where,
 * its steps (with progress when the host tracks them) and a ready-to-send
 * draft, folded until asked for.
 */
export function TodoExtras({
	fields,
	defaultDraftOpen = false,
	className,
}: {
	fields: RichTodoFields;
	defaultDraftOpen?: boolean;
	className?: string;
}) {
	const { t } = useLingui();
	const [draftOpen, setDraftOpen] = useState(defaultDraftOpen);
	const { steps, tracksSteps, draft, recipient, channel } = fields;
	const doneSteps = steps.filter((step) => step.done).length;
	const stepCount = steps.length;
	const copyDraft = () => {
		if (!draft) return;
		navigator.clipboard.writeText(draft).then(
			() => toast.success(t`Draft copied`),
			() => toast.error(t`Could not copy the draft`),
		);
	};

	return (
		<div className={cn("flex flex-col gap-2 text-xs", className)}>
			{(recipient || channel) && (
				<p className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
					<LuSend className="size-3 shrink-0" />
					<span className="truncate">
						{[recipient, channel].filter(Boolean).join(" · ")}
					</span>
				</p>
			)}
			{steps.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-[11px] text-muted-foreground">
						{tracksSteps
							? t`Steps ${doneSteps}/${stepCount}`
							: t`Steps`}
					</p>
					<ol className="flex flex-col gap-0.5">
						{steps.map((step, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered list without ids
								key={index}
								className={cn(
									"flex items-start gap-1.5",
									step.done && "text-muted-foreground line-through",
								)}
							>
								<span className="flex size-3.5 shrink-0 items-center justify-center text-[10px] tabular-nums text-muted-foreground">
									{step.done ? <LuCheck className="size-3" /> : index + 1}
								</span>
								<span className="min-w-0 whitespace-pre-wrap">{step.text}</span>
							</li>
						))}
					</ol>
				</div>
			)}
			{draft && (
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1">
						<button
							type="button"
							aria-expanded={draftOpen}
							onClick={(event) => {
								event.stopPropagation();
								setDraftOpen((open) => !open);
							}}
							className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
						>
							{draftOpen ? (
								<LuChevronDown className="size-3" />
							) : (
								<LuChevronRight className="size-3" />
							)}
							{t`Draft`}
						</button>
						<button
							type="button"
							aria-label={t`Copy the draft`}
							title={t`Copy the draft`}
							onClick={(event) => {
								event.stopPropagation();
								copyDraft();
							}}
							className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<LuCopy className="size-3" />
						</button>
					</div>
					{draftOpen ? (
						<pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-sm bg-muted p-2 font-mono text-[11px]">
							{draft}
						</pre>
					) : (
						<p className="truncate text-muted-foreground">{draft}</p>
					)}
				</div>
			)}
		</div>
	);
}

import { Trans, useLingui } from "@lingui/react/macro";
import { formatAge } from "@superset/i18n/format";
import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useState } from "react";
import { LuCheck, LuCopy, LuRotateCcw } from "react-icons/lu";
import { useCopyToClipboard } from "renderer/hooks/useCopyToClipboard";
import type { ClosedSessionEntry } from "../../types";

const COLLAPSED_COUNT = 4;

function basename(cwd: string): string {
	return cwd.split("/").filter(Boolean).pop() ?? cwd;
}

export function ClosedSessionsList({
	entries,
	now,
	resumingSessionId,
	onResume,
}: {
	entries: ClosedSessionEntry[];
	now: number;
	resumingSessionId: string | null;
	onResume: (entry: ClosedSessionEntry) => void;
}) {
	const { t } = useLingui();
	const { copyToClipboard } = useCopyToClipboard();
	const [copiedKey, setCopiedKey] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);
	if (entries.length === 0) return null;
	const shown = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);
	const hiddenCount = entries.length - COLLAPSED_COUNT;

	return (
		<section className="overflow-hidden rounded-lg border">
			<header className="flex items-baseline gap-2 border-b px-3 py-2">
				<h3 className="text-[13px] font-medium">
					<Trans>Recently closed</Trans>
				</h3>
				<span className="text-[11px] text-muted-foreground">
					<Trans>Resume reopens the conversation where it stopped</Trans>
				</span>
			</header>
			{shown.map((entry) => {
				const key = `${entry.sessionId}-${entry.closedAt}`;
				const canResume = Boolean(entry.workspaceId);
				return (
					<div
						key={key}
						className="group flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0"
					>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-[13px]">
								{entry.title ?? entry.sessionId.slice(0, 8)}
							</span>
							<span className="truncate text-[11px] text-muted-foreground">
								{basename(entry.cwd)}
							</span>
						</div>
						<span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
							{formatAge(entry.closedAt, now)}
						</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-6 shrink-0 opacity-50 group-hover:opacity-100"
									onClick={() => {
										void copyToClipboard(entry.resumeCommand);
										setCopiedKey(key);
									}}
									aria-label={t({ message: "Copy resume command" })}
								>
									{copiedKey === key ? (
										<LuCheck className="size-3.5" />
									) : (
										<LuCopy className="size-3.5" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent className="max-w-sm break-all font-mono text-[11px]">
								{entry.resumeCommand}
							</TooltipContent>
						</Tooltip>
						{canResume && (
							<Button
								variant="outline"
								size="sm"
								className="h-6 gap-1 px-2 text-[11px]"
								disabled={resumingSessionId === entry.sessionId}
								onClick={() => onResume(entry)}
							>
								<LuRotateCcw className="size-3" />
								<Trans>Resume</Trans>
							</Button>
						)}
					</div>
				);
			})}
			{hiddenCount > 0 && (
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					className="w-full px-3 py-1 text-[11px] text-muted-foreground hover:bg-foreground/[0.04]"
				>
					{expanded ? (
						<Trans>Show less</Trans>
					) : (
						<Trans>Show {hiddenCount} more</Trans>
					)}
				</button>
			)}
		</section>
	);
}

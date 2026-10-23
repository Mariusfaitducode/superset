import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { formatAge } from "@superset/i18n/format";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@superset/ui/alert-dialog";
import { formatMemory } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import type { AgentSessionView } from "../../../../types";
import { getLastAnsweredAt } from "../../../../utils/selectStaleSessions";

export function CloseSessionsDialog({
	sessions,
	now,
	onCancel,
	onConfirm,
}: {
	/** null keeps the dialog closed. */
	sessions: AgentSessionView[] | null;
	now: number;
	onCancel: () => void;
	onConfirm: (sessions: AgentSessionView[]) => void;
}) {
	const { t } = useLingui();
	const list = sessions ?? [];
	const count = list.length;
	const freed = formatMemory(list.reduce((sum, s) => sum + s.memory, 0));
	const activeCount = list.filter((s) => s.status !== "idle").length;

	return (
		<AlertDialog
			open={sessions !== null}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<AlertDialogContent className="max-w-lg">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t({
							message: plural(count, {
								one: "Close # session?",
								other: "Close # sessions?",
							}),
						})}
					</AlertDialogTitle>
					<AlertDialogDescription>
						<Trans>
							Frees about {freed}. Each one can be resumed later from “Recently
							closed”.
						</Trans>
					</AlertDialogDescription>
				</AlertDialogHeader>
				{activeCount > 0 && (
					<p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700 dark:text-amber-300">
						{t({
							message: plural(activeCount, {
								one: "# session is working or waiting for you: it stops mid-task.",
								other:
									"# sessions are working or waiting for you: they stop mid-task.",
							}),
						})}
					</p>
				)}
				<div className="max-h-72 overflow-y-auto rounded-md border">
					{list.map((session) => {
						const answeredAt = getLastAnsweredAt(session);
						return (
							<div
								key={session.sessionId}
								className="flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0"
							>
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-[13px]">{session.title}</span>
									<span className="truncate text-[11px] text-muted-foreground">
										{session.workspaceLabel}
									</span>
								</div>
								<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
									{answeredAt === null ? "—" : formatAge(answeredAt, now)}
								</span>
								<span className="w-20 shrink-0 text-right text-xs tabular-nums">
									{formatMemory(session.memory)}
								</span>
							</div>
						);
					})}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel>
						<Trans>Cancel</Trans>
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => sessions && onConfirm(sessions)}
					>
						{t({
							message: plural(count, {
								one: "Close # session",
								other: "Close # sessions",
							}),
						})}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

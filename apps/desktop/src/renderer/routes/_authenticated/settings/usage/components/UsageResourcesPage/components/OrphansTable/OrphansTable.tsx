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
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { LuCheck } from "react-icons/lu";
import { formatMemory } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import type { OrphanRow } from "../../types";

export function OrphansTable({
	orphans,
	now,
	killingPid,
	onKill,
}: {
	orphans: OrphanRow[];
	now: number;
	killingPid: number | null;
	onKill: (orphan: OrphanRow) => void;
}) {
	const { t } = useLingui();
	const [pendingKill, setPendingKill] = useState<OrphanRow | null>(null);
	const orphanCount = orphans.length;
	const total = formatMemory(orphans.reduce((sum, o) => sum + o.memory, 0));
	const pendingName = pendingKill?.name ?? "";
	const pendingPid = pendingKill?.pid ?? 0;

	if (orphans.length === 0) {
		return (
			<section className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] text-muted-foreground">
				<LuCheck className="size-3.5 text-emerald-500" />
				<Trans>No leftover processes from closed agents</Trans>
			</section>
		);
	}

	return (
		<section className="overflow-hidden rounded-lg border">
			<header className="flex flex-wrap items-baseline gap-x-2 border-b px-3 py-2">
				<h3 className="text-[13px] font-medium">
					<Trans>Leftover processes</Trans>
				</h3>
				<span className="text-[12px] text-muted-foreground tabular-nums">
					{t({
						message: plural(orphanCount, {
							one: `# process · ${total}`,
							other: `# processes · ${total}`,
						}),
					})}
				</span>
				<span className="text-[11px] text-muted-foreground">
					<Trans>Dev servers and tools whose agent or terminal is gone</Trans>
				</span>
			</header>
			{orphans.map((orphan) => {
				const orphanPid = orphan.pid;
				return (
					<div
						key={orphan.pid}
						className="group flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0 hover:bg-foreground/[0.04]"
					>
						<div className="flex min-w-0 flex-1 flex-col">
							<span
								className="truncate font-mono text-[12px]"
								title={orphan.command}
							>
								{orphan.command}
							</span>
							<span className="truncate text-[11px] text-muted-foreground">
								{orphan.cwd ?? "—"}
								{" · "}
								<Trans>pid {orphanPid}</Trans>
							</span>
						</div>
						<span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
							{orphan.startedAt === null
								? "—"
								: formatAge(orphan.startedAt, now)}
						</span>
						<span className="w-20 shrink-0 text-right text-xs tabular-nums">
							{formatMemory(orphan.memory)}
						</span>
						<Button
							variant="outline"
							size="sm"
							className="h-6 px-2 text-[11px] hover:border-red-500/50 hover:text-red-600 dark:hover:text-red-400"
							disabled={killingPid === orphan.pid}
							onClick={() => setPendingKill(orphan)}
						>
							<Trans>Kill</Trans>
						</Button>
					</div>
				);
			})}

			<AlertDialog
				open={pendingKill !== null}
				onOpenChange={(open) => {
					if (!open) setPendingKill(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<Trans>
								Kill {pendingName} (pid {pendingPid})?
							</Trans>
						</AlertDialogTitle>
						<AlertDialogDescription>
							<Trans>
								Its whole process tree gets SIGTERM, then SIGKILL after 3
								seconds.
							</Trans>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<code className="block break-all rounded-md bg-muted px-2 py-1.5 text-[11px]">
						{pendingKill?.command}
					</code>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Trans>Cancel</Trans>
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pendingKill) onKill(pendingKill);
								setPendingKill(null);
							}}
						>
							<Trans>Kill</Trans>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}

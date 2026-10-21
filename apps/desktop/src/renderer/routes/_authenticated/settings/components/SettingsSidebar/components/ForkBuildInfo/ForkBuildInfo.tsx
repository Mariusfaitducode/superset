import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { type ForkBuildStatus, parseForkBuild } from "./fork-build";

const STATUS_CLASS: Record<ForkBuildStatus, string> = {
	release: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	merged: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
	wip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

/** Which fork build is running: a release, merged but not released, or work in progress. */
export function ForkBuildInfo() {
	const { t } = useLingui();
	const raw = window.App.forkBuild;
	const build = parseForkBuild(raw);
	if (!raw) return null;
	if (!build) {
		return (
			<p className="break-all px-3 py-1.5 text-[11px] text-muted-foreground">
				{raw}
			</p>
		);
	}

	const statusLabel: Record<ForkBuildStatus, string> = {
		release: t`Release`,
		merged: t`Merged`,
		wip: t`Work in progress`,
	};
	const name =
		build.status === "release"
			? build.release
			: `${build.branch}@${build.commit}`;
	const base = build.baseRelease || t`no release`;
	const detail =
		build.status === "release"
			? build.release === build.latestRelease
				? t`Latest release`
				: t`Newer release: ${build.latestRelease}`
			: build.status === "merged"
				? t`Merged after ${base}, not released yet`
				: build.dirty
					? t`Uncommitted changes, on top of ${base}`
					: t`Not merged yet, on top of ${base}`;
	const upstream = build.upstream.replace(/^desktop-v/, "");
	const builtAt = new Date(build.builtAt).toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<div className="space-y-1 px-3 py-1.5 text-[11px]">
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"shrink-0 rounded px-1.5 py-px font-medium",
						STATUS_CLASS[build.status],
					)}
				>
					{statusLabel[build.status]}
				</span>
				<span className="min-w-0 break-all font-mono text-foreground">
					{name}
				</span>
			</div>
			<p className="text-muted-foreground">{detail}</p>
			<p className="text-muted-foreground">
				{t`Superset ${upstream} · built ${builtAt}`}
			</p>
		</div>
	);
}

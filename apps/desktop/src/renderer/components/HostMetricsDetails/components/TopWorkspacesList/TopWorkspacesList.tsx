import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import type { HostMetrics } from "renderer/hooks/host-service/useHostMetrics";

interface TopWorkspacesListProps {
	workspaces: HostMetrics["topWorkspaces"];
}

export function TopWorkspacesList({ workspaces }: TopWorkspacesListProps) {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	if (workspaces.length === 0) return null;
	const formatMemory = (bytes: number) =>
		bytes >= 1024 ** 3
			? formatNumber(bytes / 1024 ** 3, {
					style: "unit",
					unit: "gigabyte",
					maximumFractionDigits: 1,
				})
			: formatNumber(bytes / 1024 ** 2, {
					style: "unit",
					unit: "megabyte",
					maximumFractionDigits: 0,
				});
	return (
		<div className="space-y-1">
			<div className="text-[11px] text-muted-foreground">
				<Trans>Heaviest workspaces</Trans>
			</div>
			<ul className="space-y-0.5">
				{workspaces.map((workspace) => (
					<li
						key={workspace.workspaceId}
						className="flex items-baseline justify-between gap-3 text-xs"
					>
						<span className="min-w-0 truncate text-foreground">
							{workspace.label ?? t({ message: "Unnamed workspace" })}
						</span>
						<span className="shrink-0 tabular-nums text-muted-foreground">
							{formatMemory(workspace.memoryBytes)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

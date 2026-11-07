import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { useNavigate } from "@tanstack/react-router";
import type { HostMetrics } from "renderer/hooks/host-service/useHostMetrics";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";

interface TopWorkspacesListProps {
	workspaces: HostMetrics["topWorkspaces"];
	onNavigate?: () => void;
}

export function TopWorkspacesList({
	workspaces,
	onNavigate,
}: TopWorkspacesListProps) {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const navigate = useNavigate();
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
			<ul className="-mx-1.5">
				{workspaces.map((workspace) => (
					<li key={workspace.workspaceId}>
						<button
							type="button"
							onClick={() => {
								onNavigate?.();
								void navigateToV2Workspace(workspace.workspaceId, navigate);
							}}
							className="flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-fill-hover"
						>
							<span className="min-w-0 truncate text-foreground">
								{workspace.label ?? t({ message: "Unnamed workspace" })}
							</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{formatMemory(workspace.memoryBytes)}
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

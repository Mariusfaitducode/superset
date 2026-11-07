import { Trans, useLingui } from "@lingui/react/macro";
import { HostMetricsDetails } from "renderer/components/HostMetricsDetails";
import { useHostMetrics } from "renderer/hooks/host-service/useHostMetrics";
import { HighlightText } from "renderer/routes/_authenticated/settings/components/HighlightText";
import { useSettingsSearchQuery } from "renderer/stores/settings-state";

interface HostMetricsSectionProps {
	hostUrl: string | null;
	isOnline: boolean;
}

export function HostMetricsSection({
	hostUrl,
	isOnline,
}: HostMetricsSectionProps) {
	const { t } = useLingui();
	const searchQuery = useSettingsSearchQuery();
	const { data, isError } = useHostMetrics(hostUrl, isOnline);

	const body = (() => {
		if (!isOnline) {
			return <Trans>The host is offline.</Trans>;
		}
		if (data?.status === "unsupported") {
			return (
				<Trans>
					This host runs an older host service. Update it to see its load.
				</Trans>
			);
		}
		if (data?.status === "ok") return null;
		if (isError) return <Trans>Could not read the host's load.</Trans>;
		return <Trans>Loading…</Trans>;
	})();

	return (
		<section className="space-y-3">
			<h3 className="text-sm font-medium">
				<HighlightText text={t({ message: "Load" })} query={searchQuery} />
			</h3>
			{data?.status === "ok" ? (
				<div className="max-w-md">
					<HostMetricsDetails metrics={data.metrics} />
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{body}</p>
			)}
		</section>
	);
}

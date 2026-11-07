import { Plural, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { VERDICT_TONE } from "renderer/components/HostMetricsDetails";
import {
	getHostLoad,
	getHostVerdict,
	useHostMetrics,
} from "renderer/hooks/host-service/useHostMetrics";
import { useHostUrl } from "renderer/hooks/host-service/useHostTargetUrl";

/** "RAM 72% · 7 agents", toned by whether the host has room for one more. */
export function HostLoadHint({ hostId }: { hostId: string }) {
	const { t } = useLingui();
	const { formatPercent } = useFormat();
	const { data } = useHostMetrics(useHostUrl(hostId));
	if (data?.status !== "ok") return null;
	const load = getHostLoad(data.metrics);
	const tone = VERDICT_TONE[getHostVerdict(load)];
	return (
		<span className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
			<span className={tone.text}>
				{t({ message: "RAM" })}{" "}
				{formatPercent(load.memory, { maximumFractionDigits: 0 })}
			</span>
			<span>·</span>
			<Plural value={data.metrics.agents} one="# agent" other="# agents" />
		</span>
	);
}

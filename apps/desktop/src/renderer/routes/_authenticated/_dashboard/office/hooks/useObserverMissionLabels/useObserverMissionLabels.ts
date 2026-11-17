import { useLingui } from "@lingui/react/macro";
import type { ObserverMission } from "renderer/routes/_authenticated/_dashboard/office/utils/observerStatus";

export function useObserverMissionLabels(): Record<ObserverMission, string> {
	const { t } = useLingui();
	return {
		work: t`Your work`,
		efficiency: t`Efficiency`,
		superset: t`Superset`,
	};
}

import { useLingui } from "@lingui/react/macro";
import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

export function useOfficeToneLabels(): Record<OfficeTone, string> {
	const { t } = useLingui();
	return {
		need: t`Needs you`,
		working: t`Working`,
		done: t`Done, not seen`,
		failed: t`Failed`,
		idle: t`Idle`,
	};
}

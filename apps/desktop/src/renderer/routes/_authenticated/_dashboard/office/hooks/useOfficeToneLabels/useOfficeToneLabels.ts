import { useWorkStateLabels } from "renderer/components/WorkState";
import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

/** The office reads states with the words of every other surface. */
export function useOfficeToneLabels(): Record<OfficeTone, string> {
	return useWorkStateLabels().label;
}

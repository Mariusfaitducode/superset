import { formatNumber } from "@superset/i18n/format";

export function formatReplyTime(seconds: number | null): string {
	if (seconds === null) return "–";
	if (seconds < 3600) {
		return formatNumber(seconds / 60, {
			style: "unit",
			unit: "minute",
			unitDisplay: "narrow",
			maximumFractionDigits: 1,
		});
	}
	return formatNumber(seconds / 3600, {
		style: "unit",
		unit: "hour",
		unitDisplay: "narrow",
		maximumFractionDigits: 1,
	});
}

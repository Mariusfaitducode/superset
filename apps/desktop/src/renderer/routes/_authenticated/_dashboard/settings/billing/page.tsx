import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSettingsSearchQuery } from "renderer/stores/settings-state";
import { getMatchingItemsForSection } from "../utils/settings-search";
import { BillingOverview } from "./components/BillingOverview";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/billing/",
)({
	component: BillingPage,
});

function BillingPage() {
	const searchQuery = useSettingsSearchQuery();

	const visibleItems = useMemo(() => {
		if (!searchQuery) return null;
		return getMatchingItemsForSection(searchQuery, "billing").map(
			(item) => item.id,
		);
	}, [searchQuery]);

	return <BillingOverview visibleItems={visibleItems} />;
}

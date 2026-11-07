import { createFileRoute } from "@tanstack/react-router";
import { InsightsView } from "./components/InsightsView";

export const Route = createFileRoute("/_authenticated/_dashboard/insights/")({
	component: InsightsPage,
});

function InsightsPage() {
	return <InsightsView />;
}

import { createFileRoute } from "@tanstack/react-router";
import { TeamsSettings } from "./components/TeamsSettings";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/teams/",
)({
	component: TeamsPage,
});

function TeamsPage() {
	return <TeamsSettings />;
}

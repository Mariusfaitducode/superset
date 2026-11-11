import { createFileRoute } from "@tanstack/react-router";
import { TeamDetailSettings } from "./components/TeamDetailSettings";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/teams/$teamId/",
)({
	component: TeamDetailPage,
});

function TeamDetailPage() {
	const { teamId } = Route.useParams();
	return <TeamDetailSettings teamId={teamId} />;
}

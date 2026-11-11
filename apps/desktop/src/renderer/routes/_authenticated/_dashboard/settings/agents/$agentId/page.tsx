import { createFileRoute } from "@tanstack/react-router";
import { AgentsSettingsPage } from "../components/AgentsSettingsPage";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/agents/$agentId/",
)({
	component: AgentSettingsRoute,
});

function AgentSettingsRoute() {
	const { agentId } = Route.useParams();
	return <AgentsSettingsPage initialAgentId={agentId} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { ConnectionsSettings } from "./components/ConnectionsSettings";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/connections/",
)({
	component: ConnectionsSettings,
});

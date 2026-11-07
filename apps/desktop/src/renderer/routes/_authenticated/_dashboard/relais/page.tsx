import { createFileRoute } from "@tanstack/react-router";
import { RelaisView } from "./components/RelaisView";

export const Route = createFileRoute("/_authenticated/_dashboard/relais/")({
	component: RelaisView,
});

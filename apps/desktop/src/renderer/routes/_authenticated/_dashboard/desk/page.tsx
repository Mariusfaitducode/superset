import { createFileRoute } from "@tanstack/react-router";
import { DeskView } from "./components/DeskView";

export const Route = createFileRoute("/_authenticated/_dashboard/desk/")({
	component: DeskView,
});

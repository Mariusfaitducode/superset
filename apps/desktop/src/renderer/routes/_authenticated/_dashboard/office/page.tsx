import { createFileRoute } from "@tanstack/react-router";
import { OfficeView } from "./components/OfficeView";

export const Route = createFileRoute("/_authenticated/_dashboard/office/")({
	component: OfficeView,
});

import { createFileRoute } from "@tanstack/react-router";
import { GitGraphView } from "./components/GitGraphView";

export const Route = createFileRoute("/_authenticated/_dashboard/git-graph/")({
	component: GitGraphView,
});

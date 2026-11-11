import { createFileRoute, redirect } from "@tanstack/react-router";

/** Usage moved out of Settings to its own page; keep old links working. */
export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/usage/",
)({
	beforeLoad: () => {
		throw redirect({ to: "/usage", replace: true });
	},
});

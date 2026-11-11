import { createFileRoute, redirect } from "@tanstack/react-router";

/** Usage moved out of Settings to its own page; keep old deep links working. */
export const Route = createFileRoute(
	"/_authenticated/_dashboard/settings/usage/$/",
)({
	beforeLoad: ({ params }) => {
		throw redirect({ href: `/usage/${params._splat ?? ""}`, replace: true });
	},
});

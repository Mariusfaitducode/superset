import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/settings/")({
	beforeLoad: () => {
		throw redirect({ to: "/settings/account", replace: true });
	},
});

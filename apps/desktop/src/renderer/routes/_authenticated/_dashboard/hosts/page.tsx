import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HostsView } from "./components/HostsView";

export type HostsSearch = {
	/** Machine id; omitted shows this device, or the first host. */
	host?: string;
};

export const Route = createFileRoute("/_authenticated/_dashboard/hosts/")({
	component: HostsPage,
	validateSearch: (search: Record<string, unknown>): HostsSearch => ({
		host:
			typeof search.host === "string" && search.host ? search.host : undefined,
	}),
});

function HostsPage() {
	const { host } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<HostsView
			selectedMachineId={host ?? null}
			onSelect={(machineId) =>
				navigate({ search: { host: machineId }, replace: true })
			}
		/>
	);
}

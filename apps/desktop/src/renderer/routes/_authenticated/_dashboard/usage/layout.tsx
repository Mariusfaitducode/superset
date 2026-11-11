import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useIsV2CloudEnabled } from "renderer/hooks/useIsV2CloudEnabled";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { useScrollReset } from "renderer/routes/_authenticated/_dashboard/settings/hooks/useScrollReset";
import { UsageSectionToggle } from "./components/UsageSectionToggle";
import { UsageSidebarToggle } from "./components/UsageSidebarToggle";

export const Route = createFileRoute("/_authenticated/_dashboard/usage")({
	component: UsageLayout,
});

function UsageLayout() {
	const { pathname } = useLocation();
	const isV2 = useIsV2CloudEnabled();
	const contentRef = useScrollReset<HTMLDivElement>(pathname);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader
				start={<UsageSectionToggle />}
				end={isV2 ? <UsageSidebarToggle /> : undefined}
			/>
			<div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
				<Outlet />
			</div>
		</div>
	);
}

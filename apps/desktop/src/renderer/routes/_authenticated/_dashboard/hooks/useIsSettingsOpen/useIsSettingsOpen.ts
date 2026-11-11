import { useMatchRoute } from "@tanstack/react-router";

export function useIsSettingsOpen(): boolean {
	const matchRoute = useMatchRoute();
	return matchRoute({ to: "/settings", fuzzy: true }) !== false;
}

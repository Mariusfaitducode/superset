import { env } from "@/lib/env";
import { pageSlugFromUrl } from "@/lib/page-links";
import { workspaceIdFromUrl } from "@/lib/workspace-links";

// A require, not an import, so release bundles leave the module out entirely.
const devSignInTokenFromUrl = __DEV__
	? (
			require("@/lib/dev-sign-in-link") as typeof import("@/lib/dev-sign-in-link")
		).devSignInTokenFromUrl
	: null;

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}): string {
	if (devSignInTokenFromUrl?.(path)) return "/";
	const slug = pageSlugFromUrl(path, env.EXPO_PUBLIC_WEB_URL);
	if (slug !== null) return `/pages/${slug}`;
	const workspaceId = workspaceIdFromUrl(path, env.EXPO_PUBLIC_WEB_URL);
	if (workspaceId !== null)
		return `/workspace/${encodeURIComponent(workspaceId)}`;
	return path;
}

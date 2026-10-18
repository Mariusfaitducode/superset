const LINK = /^(?:superset:\/\/|\/)dev-sign-in\?(.*)$/;
const TOKEN = /^[A-Za-z0-9_-]+$/;

/**
 * Reads the one-time token from `superset://dev-sign-in?token=<token>`, the
 * link apps/mobile/scripts/eas-signin.ts opens on the simulator.
 */
export function devSignInTokenFromUrl(url: string): string | null {
	const query = LINK.exec(url)?.[1];
	if (query === undefined) return null;
	for (const pair of query.split("&")) {
		const [key, value] = pair.split("=");
		if (key === "token" && value && TOKEN.test(value)) return value;
	}
	return null;
}

import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { authClient, setJwt, signOut } from "@/lib/auth/client";
import { devSignInTokenFromUrl } from "@/lib/dev-sign-in-link";
import { clearWarmTerminals } from "@/lib/terminal/warmTerminalCache";

const redeemedTokens = new Set<string>();

/**
 * Development builds only: signs out, then signs in with the one-time token in
 * a `superset://dev-sign-in?token=` link, so apps/mobile/scripts/eas-signin.sh
 * can switch the simulator's account without a Metro restart.
 */
export function DevSignInLinkHandler() {
	const url = Linking.useURL();
	const queryClient = useQueryClient();

	useEffect(() => {
		const token = url ? devSignInTokenFromUrl(url) : null;
		if (!token || redeemedTokens.has(token)) return;
		redeemedTokens.add(token);

		void (async () => {
			const signedOut = await signOut();
			if (signedOut.error) {
				throw new Error(`Sign-out failed: ${signedOut.error.message}`);
			}
			setJwt(null);
			clearWarmTerminals();
			const signedIn = await authClient.oneTimeToken.verify({ token });
			if (signedIn.error) {
				throw new Error(`Sign-in failed: ${signedIn.error.message}`);
			}
			await authClient.getSession();
			// Not clear(): screens that stay mounted across the switch would keep the previous account's data.
			await queryClient.resetQueries();
		})().catch((error: unknown) => {
			console.error(
				"[dev-sign-in-link]",
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}, [url, queryClient]);

	return null;
}

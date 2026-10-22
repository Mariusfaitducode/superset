import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";

export interface SessionTitles {
	customTitle: string | null;
	runtimeTitle: string | null;
}

// Agents prefix their terminal title with a spinner or status glyph; the
// conversation's state already shows, so the glyph is noise.
const LEADING_GLYPHS = /^[^\p{L}\p{N}~/.([{"'`]+/u;

export function cleanTitle(title: string | null | undefined): string | null {
	const cleaned = title?.replace(LEADING_GLYPHS, "").trim();
	return cleaned ? cleaned : null;
}

export function hostTerminalTitlesQueryKey(hostUrl: string | null) {
	return ["host-terminal-titles", hostUrl] as const;
}

/**
 * Every terminal title of a host in one read, shared by all its sidebar rows
 * and the conversation switcher: one request per host instead of one per
 * workspace.
 */
export function hostTerminalTitlesQuery(hostUrl: string | null) {
	return {
		queryKey: hostTerminalTitlesQueryKey(hostUrl),
		queryFn: async (): Promise<Map<string, SessionTitles>> => {
			if (!hostUrl) return new Map();
			const { sessions } =
				await getHostServiceClientByUrl(hostUrl).terminal.list.query();
			return new Map(
				sessions.map((session): [string, SessionTitles] => [
					session.terminalId,
					{
						customTitle: cleanTitle(session.customTitle),
						runtimeTitle: cleanTitle(session.title),
					},
				]),
			);
		},
		staleTime: 10_000,
	};
}

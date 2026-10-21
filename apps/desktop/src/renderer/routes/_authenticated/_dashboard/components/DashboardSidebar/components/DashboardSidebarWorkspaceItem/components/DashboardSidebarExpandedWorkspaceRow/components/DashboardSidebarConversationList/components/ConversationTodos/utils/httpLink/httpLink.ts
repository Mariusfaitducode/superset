/** The link as an http(s) URL, or null: agents write these links. */
export function httpLink(link: string | null | undefined): string | null {
	if (!link) return null;
	try {
		const url = new URL(link);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.href
			: null;
	} catch {
		return null;
	}
}

/** The link as an http(s) URL, or null: agents write the links the app shows. */
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

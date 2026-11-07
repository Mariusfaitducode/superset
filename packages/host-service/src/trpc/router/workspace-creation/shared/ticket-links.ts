export type TicketLinkSource = "notion" | "linear" | "jira";

/** A ticket or spec the PR body links to, outside GitHub. */
export interface TicketLink {
	source: TicketLinkSource;
	url: string;
	/** The link text, the line's label ("Spec: …") or a title read from the URL. */
	title: string | null;
}

const MAX_LINKS = 3;
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"'`]+/g;
const MARKDOWN_LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g;
const NOTION_ID = /[0-9a-f]{32}$/i;

function sourceOf(url: URL): TicketLinkSource | null {
	const host = url.hostname.toLowerCase();
	if (
		host === "notion.so" ||
		host.endsWith(".notion.so") ||
		host.endsWith(".notion.site") ||
		host === "app.notion.com"
	) {
		return "notion";
	}
	if (host === "linear.app" && url.pathname.includes("/issue/")) {
		return "linear";
	}
	if (host.endsWith(".atlassian.net") && url.pathname.startsWith("/browse/")) {
		return "jira";
	}
	return null;
}

/** "Fix-the-lot-form-1a2b…" → "Fix the lot form"; Linear and Jira keys as is. */
function titleFromUrl(url: URL, source: TicketLinkSource): string | null {
	const segments = url.pathname.split("/").filter(Boolean);
	if (source === "linear") {
		const index = segments.indexOf("issue");
		return segments[index + 1]?.toUpperCase() ?? null;
	}
	if (source === "jira") return segments[1] ?? null;
	const last = decodeURIComponent(segments.at(-1) ?? "");
	if (!NOTION_ID.test(last)) return null;
	const words = last.replace(NOTION_ID, "").replace(/-/g, " ").trim();
	return words || null;
}

/** "- **Spec:** https://…" → "Spec". */
function labelBefore(line: string, url: string): string | null {
	const before = line.slice(0, line.indexOf(url));
	const label = before
		.replace(/^[\s>*+-]*(\d+\.)?\s*/, "")
		.replace(/[*_`]/g, "")
		.replace(/[\s:–—-]+$/, "")
		.trim();
	return label && label.length <= 40 ? label : null;
}

/**
 * Notion, Linear and Jira links in a PR body, in order of appearance. Read
 * from the body the search already returns, so no extra request.
 */
export function extractTicketLinks(
	body: string | null | undefined,
): TicketLink[] {
	if (!body) return [];
	const links: TicketLink[] = [];
	const seen = new Set<string>();
	const add = (raw: string, title: string | null) => {
		if (links.length >= MAX_LINKS) return;
		const href = raw.replace(/[.,;:!?]+$/, "");
		let url: URL;
		try {
			url = new URL(href);
		} catch {
			return;
		}
		const source = sourceOf(url);
		if (!source || seen.has(href)) return;
		seen.add(href);
		links.push({
			source,
			url: href,
			title: title ?? titleFromUrl(url, source),
		});
	};
	for (const line of body.split("\n")) {
		const named = new Set<string>();
		for (const match of line.matchAll(MARKDOWN_LINK)) {
			const [, text, href] = match;
			if (!text || !href) continue;
			named.add(href);
			add(href, text.trim() === href ? null : text.trim());
		}
		for (const match of line.matchAll(URL_PATTERN)) {
			const href = match[0];
			if (named.has(href)) continue;
			add(href, labelBefore(line, href));
		}
	}
	return links;
}

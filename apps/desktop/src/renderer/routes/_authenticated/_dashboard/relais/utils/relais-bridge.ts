/** Relais is a local automation runner that serves its page on this port. */
export const RELAIS_ORIGIN = "http://127.0.0.1:47820";

const THEME_VARS = [
	"--background",
	"--foreground",
	"--card",
	"--popover",
	"--primary",
	"--primary-foreground",
	"--muted",
	"--muted-foreground",
	"--accent",
	"--destructive",
	"--warning",
	"--success",
	"--border",
	"--input",
	"--ring",
	"--highlight",
	"--link",
	"--radius",
	"--fill-hover",
	"--fill-selected",
] as const;

export interface RelaisThemeMessage {
	type: "superset:theme";
	mode: "light" | "dark";
	vars: Record<string, string>;
	capabilities: string[];
}

/** The app's live theme, so custom themes carry over into the page. */
export function buildThemeMessage(root: HTMLElement): RelaisThemeMessage {
	const style = getComputedStyle(root);
	const vars: Record<string, string> = {};
	for (const name of THEME_VARS) {
		const value = style.getPropertyValue(name).trim();
		if (value) vars[name] = value;
	}
	return {
		type: "superset:theme",
		mode: root.classList.contains("light") ? "light" : "dark",
		vars,
		capabilities: ["open-workspace"],
	};
}

export type RelaisRequest =
	| { type: "relais:ready" }
	| { type: "relais:open-workspace"; workspaceId: string };

/** Accepts only messages the Relais frame sent from its own origin. */
export function parseRelaisMessage(
	event: Pick<MessageEvent, "origin" | "source" | "data">,
	frame: Window | null | undefined,
): RelaisRequest | null {
	if (!frame || event.source !== frame || event.origin !== RELAIS_ORIGIN) {
		return null;
	}
	const data = event.data as { type?: unknown; workspaceId?: unknown } | null;
	if (!data || typeof data !== "object") return null;
	if (data.type === "relais:ready") return { type: "relais:ready" };
	if (
		data.type === "relais:open-workspace" &&
		typeof data.workspaceId === "string" &&
		/^[\w-]{1,64}$/.test(data.workspaceId)
	) {
		return { type: "relais:open-workspace", workspaceId: data.workspaceId };
	}
	return null;
}

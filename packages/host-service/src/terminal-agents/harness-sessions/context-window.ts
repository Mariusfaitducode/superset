const CLAUDE_DEFAULT_CONTEXT = 200_000;
const CLAUDE_LONG_CONTEXT = 1_000_000;
const CODEX_GPT5_CONTEXT = 272_000;

/**
 * Claude transcripts record the model without its `[1m]` suffix, so a
 * request already past the default window is the only proof of the long one.
 */
export function claudeContextWindow(
	model: string | null,
	contextUsed: number,
): number {
	const id = model?.toLowerCase() ?? "";
	if (id.includes("[1m]") || id.endsWith("-1m")) return CLAUDE_LONG_CONTEXT;
	return contextUsed > CLAUDE_DEFAULT_CONTEXT
		? CLAUDE_LONG_CONTEXT
		: CLAUDE_DEFAULT_CONTEXT;
}

export function codexContextWindow(
	model: string | null,
	reported: number | null,
): number | null {
	if (reported && reported > 0) return reported;
	return model?.toLowerCase().startsWith("gpt-5") ? CODEX_GPT5_CONTEXT : null;
}

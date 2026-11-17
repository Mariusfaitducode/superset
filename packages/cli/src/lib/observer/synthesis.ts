import { readFileSync } from "node:fs";
import { CLIError } from "@superset/cli-framework";

export interface SynthesisFile {
	headline: string;
	findings: Record<string, unknown>[];
	file?: string | null;
}

/**
 * The synthesis the observer publishes, read from a JSON file so a long
 * text never goes through shell quoting. The host validates each field.
 */
export function readSynthesis(
	path: string,
	read: (path: string) => string = (file) => readFileSync(file, "utf8"),
): SynthesisFile {
	let parsed: unknown;
	try {
		parsed = JSON.parse(read(path));
	} catch (error) {
		throw new CLIError(
			`Could not read ${path} as JSON`,
			error instanceof Error ? error.message : String(error),
		);
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		typeof (parsed as SynthesisFile).headline !== "string" ||
		!Array.isArray((parsed as SynthesisFile).findings)
	) {
		throw new CLIError(
			"The synthesis needs a headline and a findings array",
			'Shape: {"headline": "...", "findings": [{"mission": "superset|work|efficiency", "title": "..."}], "file": "/path/to/synthesis.md"}',
		);
	}
	return parsed as SynthesisFile;
}

/** Hosts older than a procedure answer this instead of running it. */
export function isMissingProcedure(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /No procedure found on path/.test(message);
}

import fs from "node:fs";
import path from "node:path";
import {
	clip,
	isRecord,
	parseTimestamp,
	type SubagentTranscriptEntry,
	summarizeToolInput,
} from "../subagent-transcript";
import { defineSubagentHarness, type SubagentDetails } from "./types";

const WORKFLOW_TRANSCRIPT =
	/^(.*)\/subagents\/workflows\/(wf_[^/]+)\/agent-[^/]+\.jsonl$/;
const META_NAME = /\bname\s*:\s*['"`]([^'"`\n]{1,120})['"`]/;
const MAX_CACHED_RUN_NAMES = 64;
const runNames = new Map<string, string>();

function readMeta(transcriptPath: string): Record<string, unknown> | undefined {
	try {
		const meta = JSON.parse(
			fs.readFileSync(transcriptPath.replace(/\.jsonl$/, ".meta.json"), "utf8"),
		);
		return isRecord(meta) ? meta : undefined;
	} catch {
		return undefined;
	}
}

/** The run's `meta.name`, from `<session>/workflows/<runId>.json`; cached once found. */
function readRunName(sessionDir: string, runId: string): string | undefined {
	const file = path.join(sessionDir, "workflows", `${runId}.json`);
	const cached = runNames.get(file);
	if (cached) return cached;
	try {
		const run = JSON.parse(fs.readFileSync(file, "utf8"));
		const script =
			isRecord(run) && typeof run.script === "string" ? run.script : "";
		const name = META_NAME.exec(script)?.[1];
		if (!name) return undefined;
		if (runNames.size >= MAX_CACHED_RUN_NAMES) {
			const oldest = runNames.keys().next().value;
			if (oldest !== undefined) runNames.delete(oldest);
		}
		runNames.set(file, name);
		return name;
	} catch {
		return undefined;
	}
}

/** A workflow's children write under `subagents/workflows/<runId>/`, not `subagents/`. */
function findWorkflowTranscript(
	subagentsDir: string,
	subagentId: string,
): string | undefined {
	const workflowsDir = path.join(subagentsDir, "workflows");
	let runs: string[];
	try {
		runs = fs.readdirSync(workflowsDir);
	} catch {
		return undefined;
	}
	for (const run of runs) {
		const candidate = path.join(workflowsDir, run, `agent-${subagentId}.jsonl`);
		if (fs.existsSync(candidate)) return candidate;
	}
	return undefined;
}

/** Text of a Claude / Anthropic content block list. */
function blocksText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((block) =>
			isRecord(block) && typeof block.text === "string" ? block.text : "",
		)
		.filter(Boolean)
		.join("\n");
}

export function parseClaudeSubagentTranscript(
	text: string,
): SubagentTranscriptEntry[] {
	const entries: SubagentTranscriptEntry[] = [];
	let lineNumber = 0;
	for (const line of text.split("\n")) {
		lineNumber += 1;
		if (!line.trim()) continue;
		let record: unknown;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isRecord(record)) continue;
		const message = isRecord(record.message) ? record.message : undefined;
		if (!message) continue;
		const type = record.type;
		if (type !== "user" && type !== "assistant") continue;
		const baseId =
			typeof record.uuid === "string" ? record.uuid : `line-${lineNumber}`;
		const timestamp = parseTimestamp(record.timestamp);
		const content = message.content;

		if (typeof content === "string") {
			if (content.trim()) {
				entries.push({
					id: baseId,
					kind: type === "assistant" ? "assistant" : "user",
					text: clip(content),
					timestamp,
				});
			}
			continue;
		}
		if (!Array.isArray(content)) continue;
		content.forEach((block, index) => {
			if (!isRecord(block)) return;
			const id = `${baseId}:${index}`;
			switch (block.type) {
				case "text": {
					const body = typeof block.text === "string" ? block.text.trim() : "";
					if (!body) return;
					entries.push({
						id,
						kind: type === "assistant" ? "assistant" : "user",
						text: clip(body),
						timestamp,
					});
					return;
				}
				case "thinking": {
					const body =
						typeof block.thinking === "string" ? block.thinking.trim() : "";
					if (!body) return;
					entries.push({ id, kind: "thinking", text: clip(body), timestamp });
					return;
				}
				case "tool_use":
					entries.push({
						id,
						kind: "tool_call",
						toolName: typeof block.name === "string" ? block.name : "tool",
						text: summarizeToolInput(block.input),
						timestamp,
					});
					return;
				case "tool_result": {
					const body = blocksText(block.content).trim();
					entries.push({
						id,
						kind: "tool_result",
						text: clip(body),
						timestamp,
					});
					return;
				}
				default:
					return;
			}
		});
	}
	return entries;
}

/**
 * Claude Code. Hooks inside a child run against the parent session file
 * (`<dir>/<sessionId>.jsonl`, same session id as the parent) while the child
 * writes `<dir>/<sessionId>/subagents/agent-<id>.jsonl` with an
 * `agent-<id>.meta.json` sidecar carrying the Task description. SubagentStop
 * names the child directly as `agent_transcript_path`.
 */
export const claudeSubagentHarness = defineSubagentHarness({
	belongsToParentSession: (hint, parentSessionId) =>
		!hint.sessionId || hint.sessionId === parentSessionId,
	resolveTranscriptPath(hint) {
		if (hint.agentTranscriptPath) return hint.agentTranscriptPath;
		const { transcriptPath, sessionId, subagentId } = hint;
		if (!transcriptPath) return undefined;
		if (sessionId && path.basename(transcriptPath) === `${sessionId}.jsonl`) {
			const subagentsDir = path.join(
				path.dirname(transcriptPath),
				sessionId,
				"subagents",
			);
			const direct = path.join(subagentsDir, `agent-${subagentId}.jsonl`);
			if (fs.existsSync(direct)) return direct;
			return findWorkflowTranscript(subagentsDir, subagentId) ?? direct;
		}
		return transcriptPath;
	},
	parseTranscript: (text) => ({ entries: parseClaudeSubagentTranscript(text) }),
	readDescription(transcriptPath) {
		const meta = readMeta(transcriptPath);
		return typeof meta?.description === "string" ? meta.description : undefined;
	},
	readDetails(transcriptPath): SubagentDetails {
		const meta = readMeta(transcriptPath);
		const details: SubagentDetails = {};
		if (typeof meta?.description === "string") {
			details.description = clip(meta.description);
		}
		const match = WORKFLOW_TRANSCRIPT.exec(transcriptPath);
		if (match?.[1] && match[2]) {
			const name = readRunName(match[1], match[2]);
			details.workflow = {
				runId: match[2],
				...(name ? { name } : {}),
				...(typeof meta?.workflowPhase === "string"
					? { phase: clip(meta.workflowPhase) }
					: {}),
			};
		}
		return details;
	},
});

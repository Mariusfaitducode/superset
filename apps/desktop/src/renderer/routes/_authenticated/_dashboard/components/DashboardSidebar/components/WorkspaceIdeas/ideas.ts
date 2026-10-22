import { toast } from "@superset/ui/sonner";
import type { HostServiceClient } from "renderer/lib/host-service-client";

export type WorkspaceIdea = Awaited<
	ReturnType<HostServiceClient["workspaceIdeas"]["list"]["query"]>
>[number];
export type IdeaStatus = WorkspaceIdea["status"];

export const IDEA_STATUSES: IdeaStatus[] = ["open", "kept", "dropped", "done"];

const BULLET = /^(?:[-*+•]|\d+[.)])\s+/;
const CHECKBOX = /^\[[ xX]\]\s+/;

/** One idea per pasted line, without list bullets, numbers or checkboxes. */
export function parseIdeaLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim().replace(BULLET, "").replace(CHECKBOX, "").trim())
		.filter(Boolean);
}

/** Still to decide or to do: what the row counts and "Open" shows. */
export function isActiveIdea(idea: WorkspaceIdea): boolean {
	return idea.status === "open" || idea.status === "kept";
}

/** Active ideas first, then the closed ones; oldest first within each. */
export function sortIdeas(ideas: WorkspaceIdea[]): WorkspaceIdea[] {
	return [...ideas].sort(
		(a, b) =>
			Number(isActiveIdea(b)) - Number(isActiveIdea(a)) ||
			a.createdAt - b.createdAt,
	);
}

export function reportIdeaError(promise: Promise<unknown>, message: string) {
	promise.catch((error: unknown) =>
		toast.error(message, {
			description: error instanceof Error ? error.message : undefined,
		}),
	);
}

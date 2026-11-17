import type { TerminalAgentStore } from "../terminal-agents/store";
import type { ConversationMarkStore } from "./store";

interface BindingLike {
	terminalId: string;
	workspaceId: string;
	agentSessionId?: string;
	lastEventType: string;
	lastEventAt: number;
}

/**
 * A turn starts when a binding enters "Start" from a finished state. A
 * permission answer resumes the same turn, and the first sighting after a
 * host restart is not a transition.
 */
export function isNewTurn(
	previous: string | undefined,
	current: string,
): boolean {
	return (
		current === "Start" &&
		previous !== undefined &&
		previous !== "Start" &&
		previous !== "PermissionRequest"
	);
}

/** Applies one workspace's bindings; answers whether a mark changed. */
export function applyBindings(
	marks: ConversationMarkStore,
	lastTypes: Map<string, string>,
	bindings: readonly BindingLike[],
): boolean {
	let changed = false;
	for (const binding of bindings) {
		if (binding.agentSessionId) {
			changed =
				marks.followConversation({
					conversationId: binding.agentSessionId,
					terminalId: binding.terminalId,
					workspaceId: binding.workspaceId,
				}) || changed;
		}
		const previous = lastTypes.get(binding.terminalId);
		lastTypes.set(binding.terminalId, binding.lastEventType);
		if (isNewTurn(previous, binding.lastEventType)) {
			changed =
				marks.clearIfOlder(binding.terminalId, binding.lastEventAt) || changed;
		}
	}
	return changed;
}

/**
 * Keeps pinned conversation states honest. The rule: a pin holds until the
 * agent starts its next turn (a prompt after a stop or an error; answering a
 * permission continues the same turn), then the app infers again. A resumed
 * conversation takes its pin to its new terminal.
 */
export function watchConversationTurns({
	agentStore,
	marks,
	onChanged,
}: {
	agentStore: TerminalAgentStore;
	marks: ConversationMarkStore;
	onChanged?: () => void;
}): () => void {
	const lastTypes = new Map<string, string>();
	// The state at startup is the baseline: a pin set before a restart is
	// still dropped by the next prompt.
	try {
		applyBindings(marks, lastTypes, agentStore.list());
	} catch (error) {
		console.warn("[conversation-states] failed to read bindings", error);
	}
	const onChange = (workspaceId: string) => {
		try {
			if (
				applyBindings(marks, lastTypes, agentStore.listByWorkspace(workspaceId))
			) {
				onChanged?.();
			}
		} catch (error) {
			console.warn("[conversation-states] failed to follow turns", error);
		}
	};
	agentStore.on("change", onChange);
	return () => {
		agentStore.off("change", onChange);
	};
}

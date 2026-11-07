import type { DeskConversationItem } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

/**
 * The message an agent receives from the Desk. It names what it answers,
 * since the agent may have moved on since it reported. English like every
 * prompt the app sends to agents.
 */
export function deskMessage(
	item: DeskConversationItem,
	reply:
		| { type: "answer"; text: string }
		| { type: "approve"; editedText: string | null }
		| { type: "review"; text: string },
): string {
	// Typed straight into a conversation that stopped: no context to add.
	if (item.source === "conversation") {
		return reply.type === "approve" ? (reply.editedText ?? "") : reply.text;
	}
	const subject =
		item.source === "report" ? item.report.summary : item.todo.text;
	switch (reply.type) {
		case "answer":
			return item.source === "todo"
				? `From the Desk, about the to-do "${subject}": ${reply.text}`
				: `From the Desk, answer to "${subject}": ${reply.text}`;
		case "approve":
			return reply.editedText === null
				? `From the Desk: draft "${subject}" approved. Send exactly this text.`
				: `From the Desk: draft "${subject}" approved with edits. Send exactly this text:\n\n${reply.editedText}`;
		case "review":
			return `From the Desk, review of "${subject}": ${reply.text}`;
	}
}

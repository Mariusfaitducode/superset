import type { AgentReport } from "renderer/hooks/host-service/useHostAgentReports";
import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";

export const DESK_GROUPS = [
	"decision",
	"draft",
	"blocked",
	"done",
	"todo",
] as const;
export type DeskGroup = (typeof DESK_GROUPS)[number];

interface DeskItemBase {
	key: string;
	group: DeskGroup;
	hostUrl: string;
	workspaceId: string;
	workspaceName: string;
	terminalId: string;
	createdAt: number;
}

export type DeskItem = DeskItemBase &
	(
		| { source: "report"; report: AgentReport }
		| { source: "todo"; todo: ConversationTodo }
	);

export interface DeskHostData {
	hostUrl: string;
	reports: AgentReport[] | null;
	todos: ConversationTodo[] | null;
}

/**
 * What waits on the user across hosts: open reports, and the open to-dos
 * agents wrote for them. Progress reports stay off the Desk. Items of a
 * workspace the app no longer knows are dropped, so an archived workspace
 * leaves nothing behind. Grouped by kind, oldest first.
 */
export function buildDeskQueue(
	hosts: DeskHostData[],
	workspaceNames: ReadonlyMap<string, string>,
): DeskItem[] {
	const items: DeskItem[] = [];
	for (const { hostUrl, reports, todos } of hosts) {
		for (const report of reports ?? []) {
			const workspaceName = workspaceNames.get(report.workspaceId);
			if (
				report.status !== "open" ||
				report.kind === "progress" ||
				workspaceName === undefined
			) {
				continue;
			}
			items.push({
				key: `report:${report.id}`,
				group: report.kind,
				source: "report",
				report,
				hostUrl,
				workspaceId: report.workspaceId,
				workspaceName,
				terminalId: report.terminalId,
				createdAt: report.createdAt,
			});
		}
		for (const todo of todos ?? []) {
			const workspaceName = workspaceNames.get(todo.workspaceId);
			if (todo.done || todo.author !== "agent" || workspaceName === undefined) {
				continue;
			}
			items.push({
				key: `todo:${todo.id}`,
				group: "todo",
				source: "todo",
				todo,
				hostUrl,
				workspaceId: todo.workspaceId,
				workspaceName,
				terminalId: todo.terminalId,
				createdAt: todo.createdAt,
			});
		}
	}
	return items.sort(
		(a, b) =>
			DESK_GROUPS.indexOf(a.group) - DESK_GROUPS.indexOf(b.group) ||
			a.createdAt - b.createdAt,
	);
}

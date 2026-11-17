import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { useNavigate } from "@tanstack/react-router";
import { LuFolderOpen, LuSquareTerminal, LuX } from "react-icons/lu";
import { ConversationStatePicker } from "renderer/components/WorkState";
import { ConversationTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/components/ConversationTodos";
import type { ConversationWorkStates } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useConversationWorkStates";
import type { SidebarConversation } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import { useWorkspaceTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceTodos";
import { useOfficeProjectsStore } from "renderer/routes/_authenticated/_dashboard/office/stores/office-projects";
import type { ProjectVia } from "renderer/routes/_authenticated/_dashboard/office/utils/officeProjects";
import { OTHER_PROJECT_ID } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";

const AUTOMATIC = "__automatic__";

/**
 * The selected agent: its state (to correct in one click), its to-dos, its
 * workspace's project, and a way to its terminal.
 */
export function OfficeAgentPanel({
	workspace,
	conversation,
	workStates,
	project,
	projects,
	onClose,
}: {
	workspace: { id: string; hostId: string; name: string };
	conversation: SidebarConversation;
	workStates: ConversationWorkStates;
	project: { id: string; name: string; via: ProjectVia | null };
	projects: readonly { id: string; name: string }[];
	onClose: () => void;
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const setWorkspaceProject = useOfficeProjectsStore(
		(state) => state.setWorkspaceProject,
	);
	const viaLabel: Record<ProjectVia, string> = {
		manual: t`picked by you`,
		pullRequest: t`from its PR`,
		label: t`from a label`,
		keyword: t`from its name`,
	};
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const todos = useWorkspaceTodos({
		workspaceId: workspace.id,
		hostId: workspace.hostId,
		terminalIds: [conversation.terminalId],
		enabled: true,
	});
	const list = (todos.byTerminal.get(conversation.terminalId) ?? []).filter(
		(todo) => showAgentTodos || todo.author !== "agent",
	);

	const openTerminal = () => {
		void navigateToV2Workspace(workspace.id, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	return (
		<aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
			<div className="flex items-start gap-2 border-b border-border p-3">
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">{conversation.title}</p>
					<p className="truncate text-xs text-muted-foreground">
						{workspace.name}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={t`Close`}
					onClick={onClose}
				>
					<LuX className="size-3.5" />
				</Button>
			</div>
			<div className="px-3 pt-3">
				<ConversationStatePicker
					workspaceId={workspace.id}
					hostId={workspace.hostId}
					terminalId={conversation.terminalId}
					workStates={workStates}
					onClosed={onClose}
				/>
			</div>
			<div className="flex gap-2 p-3">
				<Button size="sm" className="flex-1" onClick={openTerminal}>
					<LuSquareTerminal className="size-3.5" />
					<Trans>Open terminal</Trans>
				</Button>
				<Button
					size="sm"
					variant="outline"
					aria-label={t`Open workspace`}
					onClick={() => void navigateToV2Workspace(workspace.id, navigate)}
				>
					<LuFolderOpen className="size-3.5" />
				</Button>
			</div>
			<div className="flex items-center gap-2 px-3 pb-3">
				<span className="shrink-0 text-xs font-medium text-muted-foreground">
					<Trans>Project</Trans>
				</span>
				<Select
					value={project.via === "manual" ? project.id : AUTOMATIC}
					onValueChange={(value) =>
						setWorkspaceProject(
							workspace.id,
							value === AUTOMATIC ? null : value,
						)
					}
				>
					<SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={AUTOMATIC} className="text-xs">
							{project.via && project.via !== "manual"
								? t`Automatic: ${project.name} (${viaLabel[project.via]})`
								: project.via === "manual"
									? t`Automatic`
									: t`Automatic: no project found`}
						</SelectItem>
						<SelectSeparator />
						{projects.map((option) => (
							<SelectItem key={option.id} value={option.id} className="text-xs">
								{option.name}
							</SelectItem>
						))}
						<SelectItem value={OTHER_PROJECT_ID} className="text-xs">
							<Trans>No project</Trans>
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
				<p className="mb-1 text-xs font-medium text-muted-foreground">
					<Trans>To-dos</Trans>
				</p>
				{todos.available ? (
					<ConversationTodos
						terminalId={conversation.terminalId}
						todos={list}
						actions={todos.actions}
						onClose={onClose}
					/>
				) : (
					<p className="text-xs text-muted-foreground">
						<Trans>This host is too old to keep to-dos.</Trans>
					</p>
				)}
			</div>
		</aside>
	);
}

import { router } from "../index";
import { agentReportsRouter } from "./agent-reports";
import { agentToolingRouter } from "./agent-tooling";
import { agentsRouter } from "./agents";
import { attachmentsRouter } from "./attachments";
import { browserRouter } from "./browser/browser";
import { configRouter } from "./config";
import { conversationTodosRouter } from "./conversation-todos";
import { filesystemRouter } from "./filesystem";
import { gitRouter } from "./git";
import { githubRouter } from "./github";
import { healthRouter } from "./health";
import { hostRouter } from "./host";
import { insightsRouter } from "./insights";
import { issuesRouter } from "./issues";
import { linkPreviewRouter } from "./link-preview";
import { mobileRouter } from "./mobile";
import { notificationsRouter } from "./notifications";
import { pageWatchRouter } from "./page-watch";
import { panesRouter } from "./panes";
import { portsRouter } from "./ports";
import { projectRouter } from "./project";
import { pullRequestsRouter } from "./pull-requests";
import { sandboxRouter } from "./sandbox";
import { settingsRouter } from "./settings";
import { systemRouter } from "./system";
import { tagFoldersRouter } from "./tag-folders";
import { terminalRouter } from "./terminal";
import { terminalAgentsRouter } from "./terminal-agents";
import { trackedTasksRouter } from "./tracked-tasks";
import { usageRouter } from "./usage";
import { workspaceRouter } from "./workspace";
import { workspaceCleanupRouter } from "./workspace-cleanup";
import { workspaceCreationRouter } from "./workspace-creation";
import { workspaceGrantsRouter } from "./workspace-grants";
import { workspaceLabelsRouter } from "./workspace-labels";
import { workspaceNotesRouter } from "./workspace-notes";
import { workspacesRouter } from "./workspaces";

export const appRouter = router({
	agentReports: agentReportsRouter,
	agents: agentsRouter,
	agentTooling: agentToolingRouter,
	attachments: attachmentsRouter,
	browser: browserRouter,
	health: healthRouter,
	host: hostRouter,
	insights: insightsRouter,
	config: configRouter,
	conversationTodos: conversationTodosRouter,
	filesystem: filesystemRouter,
	git: gitRouter,
	github: githubRouter,
	issues: issuesRouter,
	linkPreview: linkPreviewRouter,
	mobile: mobileRouter,
	notifications: notificationsRouter,
	pullRequests: pullRequestsRouter,
	project: projectRouter,
	tagFolders: tagFoldersRouter,
	pageWatch: pageWatchRouter,
	panes: panesRouter,
	ports: portsRouter,
	sandbox: sandboxRouter,
	settings: settingsRouter,
	system: systemRouter,
	terminal: terminalRouter,
	terminalAgents: terminalAgentsRouter,
	usage: usageRouter,
	workspace: workspaceRouter,
	workspaces: workspacesRouter,
	workspaceCleanup: workspaceCleanupRouter,
	workspaceCreation: workspaceCreationRouter,
	workspaceNotes: workspaceNotesRouter,
	trackedTasks: trackedTasksRouter,
	workspaceLabels: workspaceLabelsRouter,
	workspaceGrants: workspaceGrantsRouter,
});

export type AppRouter = typeof appRouter;

import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { cn } from "@superset/ui/utils";
import { useEffect, useState } from "react";
import {
	LuExternalLink,
	LuFileText,
	LuGitPullRequest,
	LuX,
} from "react-icons/lu";
import {
	useWorkStateLabels,
	WorkStateIcon,
} from "renderer/components/WorkState";
import type { WorkStateInfo } from "renderer/lib/agent-state";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useOpenPullRequestInApp } from "renderer/routes/_authenticated/_dashboard/hooks/useOpenPullRequestInApp";
import {
	PROJECT_STATUS_COLOR,
	useProjectStatusLabels,
} from "renderer/routes/_authenticated/_dashboard/office/hooks/useProjectStatusLabels";
import type { NotionSpec } from "renderer/routes/_authenticated/_dashboard/office/utils/officeProjects";
import { useMyPullRequestsStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import {
	normalizeNotionUrl,
	PROJECT_STATUSES,
	type PullRequestProject,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";

export interface OfficeProjectAgent {
	terminalId: string;
	workspaceId: string;
	title: string;
	workspaceName: string;
	work: WorkStateInfo;
}

/**
 * One project crossed with what it is made of: its Notion page and status,
 * the specs its PRs link to, its open PRs and the agents working on it.
 */
export function OfficeProjectPanel({
	project,
	pullRequests,
	specs,
	agents,
	onOpenAgent,
	onClose,
}: {
	/** Null for the agents without a project. */
	project: PullRequestProject | null;
	pullRequests: readonly MyPullRequestItem[];
	specs: readonly NotionSpec[];
	agents: readonly OfficeProjectAgent[];
	onOpenAgent: (workspaceId: string, terminalId: string) => void;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const words = useWorkStateLabels();
	const statusLabels = useProjectStatusLabels();
	const setStatus = useMyPullRequestsStore((state) => state.setProjectStatus);
	const setNotionUrl = useMyPullRequestsStore(
		(state) => state.setProjectNotionUrl,
	);
	const openPullRequest = useOpenPullRequestInApp();
	const openUrl = electronTrpc.external.openUrl.useMutation();
	const [draftUrl, setDraftUrl] = useState(project?.notionUrl ?? "");
	useEffect(() => setDraftUrl(project?.notionUrl ?? ""), [project?.notionUrl]);
	const urlInvalid = draftUrl.trim() !== "" && !normalizeNotionUrl(draftUrl);

	return (
		<aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
			<div className="flex items-start gap-2 border-b border-border p-3">
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">
						{project?.name ?? t`No project`}
					</p>
					<p className="text-xs text-muted-foreground">
						<Trans>
							{agents.length} agents · {pullRequests.length} open PRs
						</Trans>
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
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
				{project && (
					<section className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground">
							<Trans>Notion</Trans>
						</p>
						<div className="flex flex-wrap gap-1">
							{PROJECT_STATUSES.map((status) => {
								const on = project.status === status;
								return (
									<button
										key={status}
										type="button"
										aria-pressed={on}
										onClick={() => setStatus(project.id, on ? null : status)}
										className={cn(
											"flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
											on
												? "border-foreground/30 bg-accent font-medium text-foreground"
												: "border-border text-muted-foreground hover:text-foreground",
										)}
									>
										<span
											aria-hidden
											className="size-1.5 rounded-full"
											style={{ backgroundColor: PROJECT_STATUS_COLOR[status] }}
										/>
										{statusLabels[status]}
									</button>
								);
							})}
						</div>
						<p className="text-[11px] text-muted-foreground">
							<Trans>
								Keep it as in Notion's Projects board; the Office filters on it.
							</Trans>
						</p>
						<div className="flex items-center gap-1">
							<Input
								value={draftUrl}
								onChange={(event) => setDraftUrl(event.target.value)}
								onBlur={() => {
									if (!urlInvalid) setNotionUrl(project.id, draftUrl);
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !urlInvalid) {
										setNotionUrl(project.id, draftUrl);
									}
								}}
								placeholder={t`Notion page URL`}
								aria-invalid={urlInvalid}
								className="h-7 text-xs"
							/>
							{project.notionUrl && (
								<Button
									variant="outline"
									size="icon-xs"
									aria-label={t`Open in Notion`}
									title={t`Open in Notion`}
									onClick={() => openUrl.mutate(project.notionUrl as string)}
								>
									<LuExternalLink className="size-3.5" />
								</Button>
							)}
						</div>
						{urlInvalid && (
							<p className="text-[11px] text-red-500">
								<Trans>Paste a notion.so or notion.com page link.</Trans>
							</p>
						)}
					</section>
				)}
				<section className="space-y-1">
					<p className="text-xs font-medium text-muted-foreground">
						<Trans>Specs linked from its PRs</Trans>
					</p>
					{specs.length === 0 ? (
						<p className="text-[11px] text-muted-foreground">
							<Trans>None of its PRs links a Notion page.</Trans>
						</p>
					) : (
						<ul className="space-y-0.5">
							{specs.map((spec) => (
								<li key={spec.url}>
									<button
										type="button"
										onClick={() => openUrl.mutate(spec.url)}
										className="flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-muted"
									>
										<LuFileText className="size-3 shrink-0 text-muted-foreground" />
										<span className="truncate">{spec.title ?? spec.url}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
				<section className="space-y-1">
					<p className="text-xs font-medium text-muted-foreground">
						<Trans>Open PRs</Trans>
					</p>
					{pullRequests.length === 0 ? (
						<p className="text-[11px] text-muted-foreground">
							<Trans>
								No open PR known. PRs show once the Pull Requests page has
								loaded.
							</Trans>
						</p>
					) : (
						<ul className="space-y-0.5">
							{pullRequests.map((pr) => (
								<li key={pr.url}>
									<button
										type="button"
										onClick={() => openPullRequest(pr.url)}
										title={pr.title}
										className="flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-muted"
									>
										<LuGitPullRequest
											className={cn(
												"size-3 shrink-0",
												pr.isDraft ? "text-muted-foreground" : "text-green-500",
											)}
										/>
										<span className="min-w-0 flex-1 truncate">{pr.title}</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											#{pr.prNumber}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
				<section className="space-y-1">
					<p className="text-xs font-medium text-muted-foreground">
						<Trans>Agents</Trans>
					</p>
					<ul className="space-y-0.5">
						{agents.map((agent) => (
							<li key={agent.terminalId}>
								<button
									type="button"
									onClick={() =>
										onOpenAgent(agent.workspaceId, agent.terminalId)
									}
									title={words.label[agent.work.state]}
									className="flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-muted"
								>
									<WorkStateIcon
										state={agent.work.state}
										cause={agent.work.cause}
										className="size-3"
									/>
									<span className="min-w-0 flex-1 truncate">{agent.title}</span>
									<span className="max-w-24 shrink-0 truncate text-muted-foreground">
										{agent.workspaceName}
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			</div>
		</aside>
	);
}

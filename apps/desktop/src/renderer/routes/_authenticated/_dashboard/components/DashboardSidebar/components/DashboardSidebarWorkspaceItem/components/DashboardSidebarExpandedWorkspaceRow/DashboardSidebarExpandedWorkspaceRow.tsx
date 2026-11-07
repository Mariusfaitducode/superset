import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { i18n } from "@superset/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	type ComponentPropsWithoutRef,
	forwardRef,
	type KeyboardEventHandler,
	type MouseEventHandler,
	useEffect,
	useRef,
} from "react";
import { HiCheck, HiMiniXMark } from "react-icons/hi2";
import { LuArchive } from "react-icons/lu";
import { AGENT_STATE_LABEL } from "renderer/components/AgentStateDot";
import { WorkspaceNameMarquee } from "renderer/components/WorkspaceNameMarquee";
import { useFocusVisible } from "renderer/hooks/useFocusVisible";
import { HotkeyLabel } from "renderer/hotkeys";
import { pullRequestRefFromUrl } from "renderer/lib/github/pullRequestRef";
import { useDashboardSidebarWorkspacePorts } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarPortsProvider";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { ProjectThumbnail } from "renderer/routes/_authenticated/components/ProjectThumbnail";
import { RenameInput } from "renderer/screens/main/components/WorkspaceSidebar/RenameInput";
import { useInlineWorkspacePortsEnabled } from "renderer/stores/inline-workspace-ports";
import { usePullRequestPaneIntent } from "renderer/stores/pull-request-pane-intent";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { useWorkspaceAgentState } from "../../../../hooks/useWorkspaceAgentState";
import { useWorkspaceOpenTodos } from "../../../../hooks/useWorkspaceOpenTodos";
import type {
	DashboardSidebarWorkspace,
	DashboardSidebarWorkspaceIndentation,
	DashboardSidebarWorkspacePullRequest,
} from "../../../../types";
import { WorkspaceLabelPills } from "../../../WorkspaceLabels";
import {
	WorkspaceNotesBadge,
	WorkspaceNotesPanel,
} from "../../../WorkspaceNotes";
import { DashboardSidebarWorkspaceQueuedBadge } from "../DashboardSidebarWorkspaceQueuedBadge";
import { DashboardSidebarConversationList } from "./components/DashboardSidebarConversationList";
import { DashboardSidebarPortsChip } from "./components/DashboardSidebarPortsChip";
import { DashboardSidebarRowEventBoundary } from "./components/DashboardSidebarRowEventBoundary";
import { DashboardSidebarWorkspaceDetails } from "./components/DashboardSidebarWorkspaceDetails";
import { DashboardSidebarWorkspaceHostGlyph } from "./components/DashboardSidebarWorkspaceHostGlyph";
import { DashboardSidebarWorkspaceLeadIndicator } from "./components/DashboardSidebarWorkspaceLeadIndicator";

const PR_STATE_LABEL: Record<
	DashboardSidebarWorkspacePullRequest["state"],
	MessageDescriptor
> = {
	open: msg({
		message: "Open",
		context: "status",
	}),
	merged: msg({
		message: "Merged",
	}),
	closed: msg({
		message: "Closed",
	}),
	draft: msg({
		message: "Draft",
	}),
	queued: msg({
		message: "Queued",
	}),
};

interface DashboardSidebarExpandedWorkspaceRowProps
	extends ComponentPropsWithoutRef<"div"> {
	workspace: DashboardSidebarWorkspace;
	isActive: boolean;
	isRenaming: boolean;
	renameValue: string;
	isInSection?: boolean;
	indentation?: DashboardSidebarWorkspaceIndentation;
	isBulkSelectable?: boolean;
	isSelected?: boolean;
	/** Present when rendered in the Pinned section: shows the project avatar. */
	/** projectName is null for pinned project-less "session" workspaces. */
	pinnedContext?: { projectName: string | null; projectIconUrl: string | null };
	onClick?: MouseEventHandler<HTMLDivElement>;
	onKeyboardActivate?: KeyboardEventHandler<HTMLDivElement>;
	onDoubleClick?: () => void;
	onCloseWorkspaceClick: () => void;
	onRemoveFromSidebarClick: () => void;
	onRenameValueChange: (value: string) => void;
	onSubmitRename: () => void;
	onCancelRename: () => void;
}

export const DashboardSidebarExpandedWorkspaceRow = forwardRef<
	HTMLDivElement,
	DashboardSidebarExpandedWorkspaceRowProps
>(
	(
		{
			workspace,
			isActive,
			isRenaming,
			renameValue,
			isInSection = false,
			indentation,
			isBulkSelectable = false,
			isSelected = false,
			pinnedContext,
			onClick,
			onKeyboardActivate,
			onDoubleClick,
			onCloseWorkspaceClick,
			onRemoveFromSidebarClick,
			onRenameValueChange,
			onSubmitRename,
			onCancelRename,
			className,
			...props
		},
		ref,
	) => {
		const { t } = useLingui();
		const resolvedIndentation =
			indentation ?? (isInSection ? "grouped" : "workspace");
		const {
			hostType,
			hostIsOnline,
			name,
			branch,
			pullRequest,
			pendingTransaction,
		} = workspace;
		const isPending = pendingTransaction?.type === "insert";
		const localRef = useRef<HTMLDivElement>(null);
		const navigate = useNavigate();
		// Drives the name's hover-reveal for keyboard users: the row, not the
		// name span, is what's actually tabbable.
		const {
			isFocusVisible: isFocused,
			onFocus: handleRowFocus,
			onBlur: handleRowBlur,
		} = useFocusVisible();

		useEffect(() => {
			if (isActive) {
				localRef.current?.scrollIntoView({
					block: "nearest",
					behavior: "smooth",
				});
			}
		}, [isActive]);

		const creationStatusText = isPending ? t({ message: "Creating…" }) : null;
		const isCloudWorkspace = hostType === "cloud";
		const closeLabel = isCloudWorkspace
			? t({ message: "Archive workspace" })
			: t({ message: "Delete workspace" });
		const singleLineRows = useSidebarPreference("singleLineRows");
		const showRowBranch = useSidebarPreference("showRowBranch");
		const showRowPullRequest = useSidebarPreference("showRowPullRequest");
		const showRowTodos = useSidebarPreference("showRowTodos");
		const showRowWaitTime = useSidebarPreference("showRowWaitTime");
		const twoLine = !singleLineRows && !isPending;
		const pullRequestOnDetails = twoLine && showRowPullRequest;
		// Else the lead slot stays the PR's button whatever glyph precedence
		// puts in it, so a working row's PR is one click away.
		const showsPullRequest =
			!isPending && pullRequest !== null && !pullRequestOnDetails;
		const openTodos = useWorkspaceOpenTodos({
			workspaceId: workspace.id,
			hostId: workspace.hostId,
			enabled: twoLine && showRowTodos,
		});
		const openPullRequest = () => {
			if (!pullRequest) return;
			// Lands in the workspace with its PR pane open, rather than on
			// GitHub; the pane keeps the GitHub link.
			const ref = pullRequestRefFromUrl(pullRequest.url);
			if (!ref) {
				window.open(pullRequest.url, "_blank");
				return;
			}
			usePullRequestPaneIntent.getState().request({
				workspaceId: workspace.id,
				...ref,
			});
			void navigateToV2Workspace(workspace.id, navigate);
		};
		const inlinePortsEnabled = useInlineWorkspacePortsEnabled();
		const portGroup = useDashboardSidebarWorkspacePorts(workspace.id);
		const ports =
			inlinePortsEnabled && !isPending ? (portGroup?.ports ?? []) : [];
		const sandboxStatus = workspace.sandboxStatus;
		const sandboxLabel =
			sandboxStatus === "failed"
				? t({ message: "Sandbox stopped responding" })
				: sandboxStatus === "provisioning"
					? t({ message: "Creating the sandbox" })
					: null;
		const agent = useWorkspaceAgentState(workspace.id, sandboxStatus);
		const agentStateLabel =
			agent.state === "idle" ? null : i18n._(AGENT_STATE_LABEL[agent.state]);
		const leadIndicator = (
			<DashboardSidebarWorkspaceLeadIndicator
				agentState={agent.state}
				isCreatePending={isPending}
				sandboxStatus={sandboxStatus}
				pullRequestState={
					pullRequestOnDetails ? null : (pullRequest?.state ?? null)
				}
			/>
		);
		const hostGlyph = (
			<DashboardSidebarWorkspaceHostGlyph
				hostType={hostType}
				hostIsOnline={hostIsOnline}
			/>
		);
		const details = {
			hostGlyph: twoLine && hostType !== "local-device" ? hostGlyph : null,
			branch:
				twoLine && showRowBranch && name && name !== branch ? branch : null,
			pullRequest: pullRequestOnDetails ? pullRequest : null,
			todos: twoLine && showRowTodos ? openTodos : null,
			waitingSince: twoLine && showRowWaitTime ? agent.waitingSince : null,
		};
		const hasDetails =
			details.hostGlyph !== null ||
			details.branch !== null ||
			details.pullRequest !== null ||
			(details.todos?.open ?? 0) > 0 ||
			details.waitingSince !== null;

		return (
			<div
				ref={(node) => {
					localRef.current = node;
					if (typeof ref === "function") ref(node);
					else if (ref) ref.current = node;
				}}
				className={cn(
					"relative mx-2 rounded-md text-left text-sm transition-colors",
					isActive && "bg-fill-selected",
					isSelected && "bg-fill-selected",
					onClick &&
						(isSelected
							? "hover:bg-fill-selected"
							: isActive
								? "hover:bg-fill-selected"
								: "hover:bg-fill-hover"),
					className,
				)}
				data-selected={isSelected || undefined}
				{...props}
			>
				{/* biome-ignore lint/a11y/useSemanticElements: The row contains nested action buttons, so it cannot be a native button. */}
				<div
					role="button"
					tabIndex={0}
					aria-disabled={isPending ? true : undefined}
					aria-pressed={isBulkSelectable ? isSelected : undefined}
					onClick={onClick}
					onKeyDown={(event) => {
						if (onClick && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							event.stopPropagation();
							onKeyboardActivate?.(event);
						}
					}}
					onDoubleClick={onDoubleClick}
					onFocus={handleRowFocus}
					onBlur={handleRowBlur}
					className={cn(
						"group relative flex w-full flex-col justify-center pr-2",
						hasDetails ? "gap-0.5 py-1" : "h-[var(--sb-row-h)]",
						resolvedIndentation === "top-level"
							? "pl-2"
							: resolvedIndentation === "grouped"
								? "pl-10"
								: "pl-6",
						onClick && "cursor-pointer",
					)}
				>
					<div
						className={cn(
							"flex w-full items-center",
							hasDetails ? "min-h-5" : "h-full",
						)}
					>
						{isSelected ? (
							<span className="mr-2 flex size-4 shrink-0 items-center justify-center text-foreground">
								<HiCheck className="size-3.5" />
							</span>
						) : showsPullRequest && pullRequest ? (
							<Tooltip delayDuration={500}>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation();
											openPullRequest();
										}}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.stopPropagation();
											}
										}}
										aria-label={t({
											message: `Open pull request #${pullRequest.number}`,
										})}
										className="mr-2 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-foreground/10"
									>
										{leadIndicator}
									</button>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									<p className="text-xs font-medium">
										<Trans>
											PR #{pullRequest.number} —{" "}
											{i18n._(PR_STATE_LABEL[pullRequest.state])}
										</Trans>
									</p>
									{(sandboxLabel ?? agentStateLabel) && (
										<p className="text-xs text-muted-foreground">
											{sandboxLabel ?? agentStateLabel}
										</p>
									)}
									<p className="text-xs text-muted-foreground">
										<Trans>Click to open the pull request</Trans>
									</p>
								</TooltipContent>
							</Tooltip>
						) : sandboxLabel || (agentStateLabel && !isPending) ? (
							<Tooltip delayDuration={500}>
								<TooltipTrigger asChild>
									<span className="mr-2 flex size-4 shrink-0 items-center justify-center">
										{leadIndicator}
									</span>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									<p className="text-xs font-medium">
										{sandboxLabel ?? agentStateLabel}
									</p>
								</TooltipContent>
							</Tooltip>
						) : (
							<span className="mr-2 flex size-4 shrink-0 items-center justify-center">
								{leadIndicator}
							</span>
						)}

						{pinnedContext && (
							<Tooltip delayDuration={500}>
								<TooltipTrigger asChild>
									<div className="mr-1.5 flex shrink-0 items-center">
										<ProjectThumbnail
											projectName={
												pinnedContext.projectName ??
												t({
													message: "Session",
												})
											}
											iconUrl={pinnedContext.projectIconUrl}
											className="size-3.5 text-[8px]"
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									{pinnedContext.projectName ??
										t({
											message: "Session",
										})}
								</TooltipContent>
							</Tooltip>
						)}

						<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5">
							{isRenaming ? (
								<RenameInput
									value={renameValue}
									onChange={onRenameValueChange}
									onSubmit={onSubmitRename}
									onCancel={onCancelRename}
									className={cn(
										"h-5 w-full -ml-1 border-none bg-transparent px-1 py-0 text-[13px] leading-tight outline-none",
									)}
								/>
							) : (
								<>
									<WorkspaceNameMarquee
										name={name || branch}
										prefix={
											pinnedContext
												? (pinnedContext.projectName ??
													t({
														message: "Session",
													}))
												: undefined
										}
										forceActive={isFocused}
										className={cn(
											"text-[13px] leading-tight transition-colors",
											isActive || isSelected
												? "text-foreground"
												: "text-foreground/80",
										)}
									/>
									{isSelected && (
										<span className="sr-only">
											<Trans>, selected</Trans>
										</span>
									)}
								</>
							)}

							<div
								className={cn(
									"col-start-2 row-start-1 flex min-h-5 shrink-0 items-center gap-2",
									twoLine && "max-w-44",
								)}
							>
								{creationStatusText ? (
									<span className="text-[11px] text-muted-foreground">
										{creationStatusText}
									</span>
								) : (
									<>
										<WorkspaceLabelPills
											workspaceId={workspace.id}
											hostId={workspace.hostId}
											all={twoLine}
										/>
										<DashboardSidebarWorkspaceQueuedBadge
											workspaceId={workspace.id}
										/>
										<WorkspaceNotesBadge
											workspaceId={workspace.id}
											hostId={workspace.hostId}
										/>
									</>
								)}
								{!twoLine && hostGlyph}
								{!isPending && !isSelected && (
									<div className="hidden items-center justify-end group-hover:flex group-focus-within:flex">
										<Tooltip delayDuration={300}>
											<TooltipTrigger asChild>
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation();
														onCloseWorkspaceClick();
													}}
													onKeyDown={(event) => {
														if (
															event.key === "Enter" ||
															event.key === " " ||
															event.key === "Spacebar"
														) {
															event.stopPropagation();
														}
													}}
													className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
													aria-label={closeLabel}
												>
													{isCloudWorkspace ? (
														<LuArchive className="size-3.5" />
													) : (
														<HiMiniXMark className="size-3.5" />
													)}
												</button>
											</TooltipTrigger>
											<TooltipContent side="top">
												<HotkeyLabel
													label={closeLabel}
													id={isActive ? "CLOSE_WORKSPACE" : undefined}
												/>
											</TooltipContent>
										</Tooltip>
									</div>
								)}
								{ports.length > 0 && (
									<DashboardSidebarRowEventBoundary>
										<DashboardSidebarPortsChip ports={ports} />
									</DashboardSidebarRowEventBoundary>
								)}
							</div>
						</div>
					</div>
					{hasDetails && (
						<div className="pl-6">
							<DashboardSidebarWorkspaceDetails
								{...details}
								onPullRequestClick={openPullRequest}
							/>
						</div>
					)}
				</div>
				{!isPending && (
					<WorkspaceNotesPanel
						workspaceId={workspace.id}
						hostId={workspace.hostId}
						isInSection={isInSection}
						indentation={resolvedIndentation}
					/>
				)}
				{!isPending && (
					<DashboardSidebarConversationList
						workspaceId={workspace.id}
						hostId={workspace.hostId}
						isInSection={isInSection}
						indentation={resolvedIndentation}
					/>
				)}
			</div>
		);
	},
);

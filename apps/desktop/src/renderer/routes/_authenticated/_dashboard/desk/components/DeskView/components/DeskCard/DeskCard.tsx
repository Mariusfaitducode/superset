import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { Button } from "@superset/ui/button";
import { Kbd } from "@superset/ui/kbd";
import { Textarea } from "@superset/ui/textarea";
import { cn } from "@superset/ui/utils";
import {
	type Ref,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	LuCircleCheck,
	LuExternalLink,
	LuFileText,
	LuFlaskConical,
	LuListOrdered,
	LuSend,
	LuX,
} from "react-icons/lu";
import { useNow } from "renderer/hooks/useNow";
import {
	dueState,
	localDay,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/todo-order";
import { ReportKindIcon } from "renderer/routes/_authenticated/_dashboard/components/ReportKindIcon";
import { TodoExtras } from "renderer/routes/_authenticated/_dashboard/components/TodoExtras";
import { TodoKindIcon } from "renderer/routes/_authenticated/_dashboard/components/TodoKindIcon";
import {
	type DeskItem,
	type DeskKind,
	readRichTodo,
} from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import type { DeskActions } from "../../hooks/useDeskActions";

export interface DeskCardHandle {
	focusReply: () => void;
	pickOption: (index: number) => void;
	primary: () => void;
	dismiss: () => void;
}

function ExternalLink({ href }: { href: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer noopener"
			onClick={(event) => event.stopPropagation()}
			className="flex w-fit max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
		>
			<LuExternalLink className="size-3 shrink-0" />
			<span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
		</a>
	);
}

/**
 * One row of the Needs you list: what it is, where it comes from, how long
 * it has waited and its main action. The selected row unfolds to show the
 * details and the reply box.
 */
export function DeskCard({
	item,
	conversationTitle,
	selected,
	onSelect,
	actions,
	ref,
}: {
	item: DeskItem;
	conversationTitle: string | null;
	selected: boolean;
	onSelect: () => void;
	actions: DeskActions;
	ref?: Ref<DeskCardHandle>;
}) {
	const { t } = useLingui();
	const now = useNow(30_000);
	const cardRef = useRef<HTMLElement>(null);
	const replyRef = useRef<HTMLTextAreaElement>(null);
	const report = item.source === "report" ? item.report : null;
	const todo = item.source === "todo" ? item.todo : null;
	const rich = todo ? readRichTodo(todo) : null;
	const draftText = report?.draft?.text ?? "";
	const [reply, setReply] = useState("");
	const [draft, setDraft] = useState(draftText);
	const [busy, setBusy] = useState(false);
	const canReply = item.source !== "pr" && item.kind !== "request";

	useEffect(() => {
		if (selected) cardRef.current?.scrollIntoView({ block: "nearest" });
	}, [selected]);

	const run = async (action: () => Promise<boolean>) => {
		if (busy) return;
		setBusy(true);
		const ok = await action();
		setBusy(false);
		if (ok) setReply("");
	};

	const focusReply = () => {
		onSelect();
		// The reply box shows once the row is selected.
		requestAnimationFrame(() => replyRef.current?.focus());
	};

	const sendReply = () => {
		const text = reply.trim();
		if (!text || item.source === "pr") return;
		void run(() =>
			item.kind === "done"
				? actions.review(item, text)
				: actions.answer(item, text),
		);
	};

	const primary = () => {
		if (item.source === "pr") {
			actions.open(item);
			return;
		}
		switch (item.kind) {
			case "draft":
				void run(() =>
					actions.approveDraft(item, draft === draftText ? null : draft),
				);
				return;
			case "done":
				void run(() => actions.review(item, reply.trim()));
				return;
			case "todo":
				void run(() => actions.checkTodo(item));
				return;
			case "request":
			case "failed":
				actions.open(item);
				return;
			default:
				focusReply();
		}
	};

	const pickOption = (index: number) => {
		const option = report?.options[index];
		if (option && item.source === "report") {
			void run(() => actions.answer(item, option));
		}
	};

	const canDismiss =
		item.source === "report" ||
		(item.source === "conversation" && item.kind === "unseen");
	const dismiss = () => {
		if (canDismiss) void run(() => actions.dismiss(item));
	};

	useImperativeHandle(ref, () => ({
		focusReply: () => {
			if (canReply) focusReply();
		},
		pickOption,
		primary,
		dismiss,
	}));

	const kindLabel: Record<DeskKind, string> = {
		request: t`Asks you`,
		failed: t`Failed`,
		unseen: t`Your turn`,
		decision: t`Decision`,
		draft: t`Draft`,
		blocked: t`Blocked`,
		done: t`To review`,
		todo: t`To-do`,
		pr: t`PR review`,
	};

	const primaryLabel: Record<DeskKind, string> = {
		request: t`Open`,
		failed: t`Open`,
		unseen: t`Answer`,
		decision: t`Answer`,
		draft: t`Approve and send`,
		blocked: t`Answer`,
		done: t`Mark reviewed`,
		todo: t`Check off`,
		pr: t`Open PR`,
	};

	const title =
		item.source === "report"
			? item.report.summary
			: item.source === "todo"
				? item.todo.text
				: item.source === "conversation"
					? item.conversation.title
					: `#${item.pr.prNumber} ${item.pr.title}`;

	const origin =
		item.source === "pr"
			? [item.pr.repoFullName, item.projectName, item.pr.authorLogin]
			: [
					item.source !== "conversation" && conversationTitle
						? `${item.workspaceName} › ${conversationTitle}`
						: item.workspaceName,
					item.projectName,
				];

	const draftTarget = report?.draft
		? {
				slack: "Slack",
				github: "GitHub",
				notion: "Notion",
				email: t`Email`,
			}[report.draft.target]
		: "";

	const due = todo ? dueState(todo.dueOn, localDay(now)) : null;
	const dueDay = todo?.dueOn
		? new Date(`${todo.dueOn}T00:00:00`).toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
			})
		: "";
	const waitingSince = new Date(item.waitingSince).toLocaleString();
	const prLink = item.source === "pr" ? item.pr.url : null;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the Desk's j/k keys select rows
		<article
			ref={cardRef}
			onClick={onSelect}
			aria-current={selected ? "true" : undefined}
			className={cn(
				"group/desk-row flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-sm",
				selected ? "border-primary ring-1 ring-primary/40" : "border-border",
				busy && "opacity-60",
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<ReportKindIcon kind={item.kind} className="size-4" />
				<div className="flex min-w-0 flex-1 flex-col">
					<p
						className={cn(
							"truncate font-medium",
							selected && "whitespace-normal",
						)}
					>
						{title}
					</p>
					<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[11px] font-medium text-foreground/80">
							{kindLabel[item.kind]}
						</span>
						{todo && (
							<TodoKindIcon kind={todo.kind} className="size-3 shrink-0" />
						)}
						{todo?.priority === "high" && (
							<span className="shrink-0 text-red-500">{t`High`}</span>
						)}
						{todo?.dueOn && due && (
							<span
								className={cn(
									"shrink-0 tabular-nums",
									due === "overdue"
										? "text-red-500"
										: due === "today"
											? "text-amber-500"
											: undefined,
								)}
							>
								{due === "today" ? t`Due today` : t`Due ${dueDay}`}
							</span>
						)}
						{rich && rich.steps.length > 0 && (
							<span className="flex shrink-0 items-center gap-0.5 tabular-nums">
								<LuListOrdered className="size-3" />
								{rich.tracksSteps
									? `${rich.steps.filter((step) => step.done).length}/${rich.steps.length}`
									: rich.steps.length}
							</span>
						)}
						{rich?.draft && (
							<LuFileText
								className="size-3 shrink-0"
								aria-label={t`Has a draft`}
							/>
						)}
						<span className="min-w-0 truncate">
							{origin.filter(Boolean).join(" · ")}
						</span>
					</div>
				</div>
				<span
					className="shrink-0 text-xs tabular-nums text-muted-foreground"
					title={t`Waiting since ${waitingSince}`}
				>
					{formatCompactRelativeTime(
						Math.min(item.waitingSince, now.getTime()),
						now.getTime(),
					)}
				</span>
				<Button
					size="xs"
					variant={selected ? "default" : "outline"}
					disabled={busy}
					onClick={(event) => {
						event.stopPropagation();
						onSelect();
						primary();
					}}
					className="shrink-0"
				>
					{primaryLabel[item.kind]}
					{selected && <Kbd>A</Kbd>}
				</Button>
			</div>

			{selected && (
				<div className="flex flex-col gap-2 pl-6">
					{report?.details && (
						<p className="whitespace-pre-wrap text-muted-foreground">
							{report.details}
						</p>
					)}

					{report?.checks && (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<LuCircleCheck className="mt-0.5 size-3.5 shrink-0" />
							<span className="whitespace-pre-wrap">{report.checks}</span>
						</p>
					)}
					{report?.test && (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<LuFlaskConical className="mt-0.5 size-3.5 shrink-0" />
							<span className="whitespace-pre-wrap">{report.test}</span>
						</p>
					)}

					{(report?.links.length ?? 0) > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{report?.links.map((link) => (
								<ExternalLink key={link} href={link} />
							))}
						</div>
					)}
					{todo?.link && <ExternalLink href={todo.link} />}
					{prLink && <ExternalLink href={prLink} />}

					{rich && <TodoExtras fields={rich} defaultDraftOpen />}

					{report?.draft && (
						<div className="flex flex-col gap-1">
							<span className="text-xs text-muted-foreground">
								{t`Draft for ${draftTarget}`}
							</span>
							<Textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								className="min-h-24 font-mono text-xs"
							/>
						</div>
					)}

					{(report?.options.length ?? 0) > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{report?.options.map((option, index) => (
								<Button
									key={option}
									size="xs"
									variant="outline"
									disabled={busy}
									onClick={(event) => {
										event.stopPropagation();
										pickOption(index);
									}}
								>
									<Kbd>{index + 1}</Kbd>
									{option}
								</Button>
							))}
						</div>
					)}

					{canReply && (
						<div className="flex items-end gap-2">
							<Textarea
								ref={replyRef}
								value={reply}
								onChange={(event) => setReply(event.target.value)}
								onKeyDown={(event) => {
									if (
										event.key === "Enter" &&
										(event.metaKey || event.ctrlKey)
									) {
										event.preventDefault();
										sendReply();
									}
									if (event.key === "Escape") event.currentTarget.blur();
								}}
								placeholder={
									item.kind === "done"
										? t`Follow-up for the agent (optional)`
										: t`Answer the agent`
								}
								rows={1}
								className="min-h-8 flex-1 resize-none text-xs"
							/>
							<Button
								size="xs"
								variant="ghost"
								disabled={busy || !reply.trim()}
								aria-label={t`Send`}
								title={t`Send (⌘Enter)`}
								onClick={(event) => {
									event.stopPropagation();
									sendReply();
								}}
							>
								<LuSend />
							</Button>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-1.5">
						<Button
							size="xs"
							variant="ghost"
							onClick={(event) => {
								event.stopPropagation();
								actions.open(item);
							}}
						>
							{item.source === "pr" ? t`Open PR` : t`Open conversation`}
							<Kbd>↵</Kbd>
						</Button>
						{canReply && (
							<span className="text-xs text-muted-foreground">
								<Kbd>R</Kbd> {t`answer`}
							</span>
						)}
						{canDismiss && (
							<Button
								size="xs"
								variant="ghost"
								disabled={busy}
								className="ml-auto text-muted-foreground"
								onClick={(event) => {
									event.stopPropagation();
									dismiss();
								}}
							>
								<LuX />
								{item.source === "conversation" ? t`Mark seen` : t`Dismiss`}
								<Kbd>X</Kbd>
							</Button>
						)}
					</div>
				</div>
			)}
		</article>
	);
}

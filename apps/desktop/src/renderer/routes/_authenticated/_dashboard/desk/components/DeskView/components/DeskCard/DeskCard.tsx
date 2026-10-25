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
	LuFlaskConical,
	LuSend,
	LuX,
} from "react-icons/lu";
import { useNow } from "renderer/hooks/useNow";
import { httpLink } from "renderer/lib/httpLink";
import { ReportKindIcon } from "renderer/routes/_authenticated/_dashboard/components/ReportKindIcon";
import type { DeskItem } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import type { DeskActions } from "../../hooks/useDeskActions";

export interface DeskCardHandle {
	focusReply: () => void;
	pickOption: (index: number) => void;
	primary: () => void;
	dismiss: () => void;
}

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
	const now = useNow(30_000).getTime();
	const cardRef = useRef<HTMLElement>(null);
	const replyRef = useRef<HTMLTextAreaElement>(null);
	const report = item.source === "report" ? item.report : null;
	const reportLinks = (report?.links ?? []).flatMap((link) => {
		const href = httpLink(link);
		return href ? [href] : [];
	});
	const todoLink = item.source === "todo" ? httpLink(item.todo.link) : null;
	const draftText = report?.draft?.text ?? "";
	const [reply, setReply] = useState("");
	const [draft, setDraft] = useState(draftText);
	const [busy, setBusy] = useState(false);

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

	const sendReply = () => {
		const text = reply.trim();
		if (!text) return;
		void run(() =>
			item.group === "done"
				? actions.review(item, text)
				: actions.answer(item, text),
		);
	};

	const primary = () => {
		switch (item.group) {
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
			default:
				replyRef.current?.focus();
		}
	};

	const pickOption = (index: number) => {
		const option = report?.options[index];
		if (option) void run(() => actions.answer(item, option));
	};

	const dismiss = () => {
		if (item.source === "report") void run(() => actions.dismiss(item));
	};

	useImperativeHandle(ref, () => ({
		focusReply: () => replyRef.current?.focus(),
		pickOption,
		primary,
		dismiss,
	}));

	const draftTarget = report?.draft
		? {
				slack: "Slack",
				github: "GitHub",
				notion: "Notion",
				email: t`Email`,
			}[report.draft.target]
		: "";

	const primaryLabel =
		item.group === "draft"
			? t`Approve and send`
			: item.group === "done"
				? t`Mark reviewed`
				: item.group === "todo"
					? t`Check off`
					: null;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the Desk's j/k keys select cards
		<article
			ref={cardRef}
			onClick={onSelect}
			aria-current={selected ? "true" : undefined}
			className={cn(
				"flex flex-col gap-2 rounded-md border bg-card p-3 text-sm",
				selected ? "border-primary ring-1 ring-primary/40" : "border-border",
				busy && "opacity-60",
			)}
		>
			<div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
				<ReportKindIcon kind={item.group} className="size-3.5" />
				<span className="truncate font-medium text-foreground">
					{item.workspaceName}
				</span>
				{conversationTitle && (
					<span className="min-w-0 truncate">· {conversationTitle}</span>
				)}
				<span className="ml-auto shrink-0 tabular-nums">
					{formatCompactRelativeTime(Math.min(item.createdAt, now), now)}
				</span>
			</div>

			<p className="font-medium">
				{report ? report.summary : item.source === "todo" && item.todo.text}
			</p>

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

			{reportLinks.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{reportLinks.map((link) => (
						<a
							key={link}
							href={link}
							target="_blank"
							rel="noreferrer noopener"
							onClick={(event) => event.stopPropagation()}
							className="flex max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
						>
							<LuExternalLink className="size-3 shrink-0" />
							<span className="truncate">
								{link.replace(/^https?:\/\//, "")}
							</span>
						</a>
					))}
				</div>
			)}

			{todoLink && (
				<a
					href={todoLink}
					target="_blank"
					rel="noreferrer noopener"
					onClick={(event) => event.stopPropagation()}
					className="flex w-fit max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
				>
					<LuExternalLink className="size-3 shrink-0" />
					<span className="truncate">
						{todoLink.replace(/^https?:\/\//, "")}
					</span>
				</a>
			)}

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

			<div className="flex items-end gap-2">
				<Textarea
					ref={replyRef}
					value={reply}
					onChange={(event) => setReply(event.target.value)}
					onFocus={onSelect}
					onKeyDown={(event) => {
						if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							sendReply();
						}
						if (event.key === "Escape") event.currentTarget.blur();
					}}
					placeholder={
						item.group === "done"
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

			<div className="flex flex-wrap items-center gap-1.5">
				{primaryLabel && (
					<Button
						size="xs"
						disabled={busy}
						onClick={(event) => {
							event.stopPropagation();
							primary();
						}}
					>
						{primaryLabel}
						<Kbd>A</Kbd>
					</Button>
				)}
				<Button
					size="xs"
					variant="ghost"
					onClick={(event) => {
						event.stopPropagation();
						actions.open(item);
					}}
				>
					{t`Open conversation`}
					<Kbd>↵</Kbd>
				</Button>
				{item.source === "report" && (
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
						{t`Dismiss`}
						<Kbd>X</Kbd>
					</Button>
				)}
			</div>
		</article>
	);
}

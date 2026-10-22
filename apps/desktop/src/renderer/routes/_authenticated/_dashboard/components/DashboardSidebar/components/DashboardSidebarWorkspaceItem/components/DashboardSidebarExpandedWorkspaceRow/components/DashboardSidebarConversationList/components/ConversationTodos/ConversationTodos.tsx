import { useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { toast } from "@superset/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@superset/ui/toggle-group";
import { cn } from "@superset/ui/utils";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import type { IconType } from "react-icons";
import {
	LuBot,
	LuCheck,
	LuCode,
	LuEllipsis,
	LuExternalLink,
	LuGitPullRequest,
	LuMessageSquare,
} from "react-icons/lu";
import type {
	ConversationTodo,
	TodoActions,
	TodoFields,
} from "../../hooks/useWorkspaceTodos";
import { dueState, localDay } from "../../utils/todo-order";
import { httpLink } from "./utils/httpLink";

type Priority = ConversationTodo["priority"];
type Kind = ConversationTodo["kind"];

const KIND_ICON: Partial<Record<Kind, IconType>> = {
	code: LuCode,
	message: LuMessageSquare,
	review: LuGitPullRequest,
};

const DUE_CLASS = {
	overdue: "text-red-500",
	today: "text-amber-500",
	later: "text-muted-foreground",
} as const;

function formatDay(dueOn: string): string {
	return new Date(`${dueOn}T00:00:00`).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
	});
}

function report(promise: Promise<unknown>, message: string) {
	promise.catch((error: unknown) =>
		toast.error(message, {
			description: error instanceof Error ? error.message : undefined,
		}),
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-1">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			{children}
		</div>
	);
}

function TodoDetails({
	todo,
	onChange,
	onDelete,
}: {
	todo: ConversationTodo;
	onChange: (fields: TodoFields) => void;
	onDelete: () => void;
}) {
	const { t } = useLingui();
	const [link, setLink] = useState(todo.link ?? "");
	const priorities: { value: Priority; label: string }[] = [
		{ value: "high", label: t`High` },
		{ value: "normal", label: t`Normal` },
		{ value: "low", label: t`Low` },
	];
	const kinds: { value: Kind; label: string }[] = [
		{ value: "code", label: t`Code` },
		{ value: "message", label: t`Message` },
		{ value: "review", label: t`Review` },
		{ value: "other", label: t`Other` },
	];
	const commitLink = () => {
		const trimmed = link.trim();
		const next = trimmed ? httpLink(trimmed) : null;
		if (trimmed && !next) {
			setLink(todo.link ?? "");
			return;
		}
		if (next !== todo.link) onChange({ link: next });
	};

	return (
		<div className="space-y-3">
			<Field label={t`Priority`}>
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={todo.priority}
					onValueChange={(value) =>
						value && onChange({ priority: value as Priority })
					}
				>
					{priorities.map((item) => (
						<ToggleGroupItem
							key={item.value}
							value={item.value}
							className="px-2 text-xs"
						>
							{item.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</Field>
			<Field label={t`Type`}>
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={todo.kind}
					onValueChange={(value) => value && onChange({ kind: value as Kind })}
				>
					{kinds.map((item) => (
						<ToggleGroupItem
							key={item.value}
							value={item.value}
							className="px-2 text-xs"
						>
							{item.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</Field>
			<Field label={t`Due`}>
				<Input
					type="date"
					value={todo.dueOn ?? ""}
					onChange={(event) => onChange({ dueOn: event.target.value || null })}
					className="h-7 text-xs"
				/>
			</Field>
			<Field label={t`Link`}>
				<Input
					type="url"
					value={link}
					placeholder="https://…"
					onChange={(event) => setLink(event.target.value)}
					onBlur={commitLink}
					onKeyDown={(event) => {
						if (event.key === "Enter") commitLink();
					}}
					className="h-7 text-xs"
				/>
			</Field>
			<Button
				variant="ghost"
				size="sm"
				onClick={onDelete}
				className="h-7 w-full text-xs text-red-500 hover:text-red-500"
			>
				{t`Delete to-do`}
			</Button>
		</div>
	);
}

function TodoItem({
	todo,
	today,
	actions,
}: {
	todo: ConversationTodo;
	today: string;
	actions: TodoActions;
}) {
	const { t } = useLingui();
	const [draft, setDraft] = useState<string | null>(null);
	const KindIcon = KIND_ICON[todo.kind];
	const due = dueState(todo.dueOn, today);
	const safeLink = httpLink(todo.link);
	const failed = t`Could not update the to-do`;

	const commit = () => {
		const text = draft?.trim();
		setDraft(null);
		if (text && text !== todo.text) {
			report(actions.update(todo.id, { text }), failed);
		}
	};

	return (
		<li className="group/todo flex h-6 items-center gap-1.5 rounded-sm pr-1 hover:bg-muted/60">
			<button
				type="button"
				aria-pressed={todo.done}
				aria-label={todo.done ? t`Mark as not done` : t`Mark as done`}
				title={todo.doneBy === "agent" ? t`Checked by the agent` : undefined}
				onClick={() => report(actions.setDone(todo.id, !todo.done), failed)}
				className={cn(
					"flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
					todo.done
						? todo.doneBy === "agent"
							? "border-violet-500 bg-violet-500 text-white"
							: "border-primary bg-primary text-primary-foreground"
						: todo.priority === "high"
							? "border-red-500 hover:border-red-400"
							: "border-muted-foreground/50 hover:border-foreground",
				)}
			>
				{todo.done && <LuCheck className="size-2.5" strokeWidth={3} />}
			</button>
			{todo.author === "agent" && (
				<LuBot
					className="size-3 shrink-0 text-violet-500"
					aria-label={t`Added by the agent`}
				/>
			)}
			{KindIcon && (
				<KindIcon className="size-3 shrink-0 text-muted-foreground" />
			)}
			{draft !== null ? (
				<input
					// biome-ignore lint/a11y/noAutofocus: the user just asked to edit this item
					autoFocus
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.nativeEvent.isComposing)
							commit();
						if (event.key === "Escape") setDraft(null);
					}}
					className="h-5 min-w-0 flex-1 rounded-sm bg-background px-1 text-xs outline-none ring-1 ring-ring"
				/>
			) : (
				<button
					type="button"
					onClick={() => setDraft(todo.text)}
					title={todo.text}
					className={cn(
						"min-w-0 flex-1 truncate text-left text-xs",
						todo.done && "text-muted-foreground line-through",
						!todo.done && todo.priority === "low" && "text-muted-foreground",
					)}
				>
					{todo.text}
				</button>
			)}
			{due && !todo.done && (
				<span
					className={cn("shrink-0 text-[10px] tabular-nums", DUE_CLASS[due])}
				>
					{due === "today" ? t`Today` : formatDay(todo.dueOn ?? "")}
				</span>
			)}
			{safeLink && (
				<a
					href={safeLink}
					target="_blank"
					rel="noreferrer noopener"
					aria-label={t`Open link`}
					title={safeLink}
					className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<LuExternalLink className="size-3" />
				</a>
			)}
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label={t`To-do details`}
						className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/todo:opacity-100 data-[state=open]:opacity-100"
					>
						<LuEllipsis className="size-3" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" align="start" className="w-64 p-3">
					<TodoDetails
						todo={todo}
						onChange={(fields) =>
							report(actions.update(todo.id, fields), failed)
						}
						onDelete={() => report(actions.remove(todo.id), failed)}
					/>
				</PopoverContent>
			</Popover>
		</li>
	);
}

/**
 * One conversation's to-dos, shared with its agent: the agent's own are
 * marked, and so are the user's it checked. Click the text to edit it, the
 * menu for priority, type, due day and link. Opens ready to type; Escape
 * clears the draft, then closes.
 */
export function ConversationTodos({
	terminalId,
	todos,
	actions,
	onClose,
}: {
	terminalId: string;
	todos: ConversationTodo[];
	actions: TodoActions;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const today = localDay(new Date());
	const doneCount = todos.filter((todo) => todo.done).length;
	const failed = t`Could not update the to-do`;

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			if (text) setText("");
			else onClose();
			return;
		}
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		if (!text.trim()) return;
		report(actions.add(terminalId, text), failed);
		setText("");
	};

	return (
		<div className="ml-[7px] border-l border-border pb-1 pl-2.5">
			{todos.length > 0 && (
				<ul className="flex flex-col">
					{todos.map((todo) => (
						<TodoItem
							key={todo.id}
							todo={todo}
							today={today}
							actions={actions}
						/>
					))}
				</ul>
			)}
			<div className="flex h-6 items-center gap-1.5">
				<input
					// biome-ignore lint/a11y/noAutofocus: the user just opened the to-dos to add one
					autoFocus
					value={text}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={t`Add a to-do…`}
					className="h-5 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring"
				/>
				{doneCount > 0 && (
					<button
						type="button"
						onClick={() => report(actions.clearDone(terminalId), failed)}
						className="shrink-0 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						{t`Clear ${doneCount} done`}
					</button>
				)}
			</div>
		</div>
	);
}

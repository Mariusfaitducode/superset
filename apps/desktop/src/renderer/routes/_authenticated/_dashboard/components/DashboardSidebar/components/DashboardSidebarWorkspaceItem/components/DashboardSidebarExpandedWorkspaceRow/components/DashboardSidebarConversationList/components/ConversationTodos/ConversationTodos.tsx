import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { type KeyboardEvent, useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import {
	type ConversationTodo,
	useConversationTodosStore,
} from "renderer/stores/conversation-todos";

const EMPTY: ConversationTodo[] = [];

function TodoItem({
	conversationId,
	todo,
}: {
	conversationId: string;
	todo: ConversationTodo;
}) {
	const { t } = useLingui();
	const toggleTodo = useConversationTodosStore((state) => state.toggleTodo);
	const editTodo = useConversationTodosStore((state) => state.editTodo);
	const removeTodo = useConversationTodosStore((state) => state.removeTodo);
	const [draft, setDraft] = useState<string | null>(null);

	const commit = () => {
		if (draft !== null) editTodo(conversationId, todo.id, draft);
		setDraft(null);
	};

	return (
		<li className="group/todo flex h-6 items-center gap-1.5 rounded-sm pr-1 hover:bg-muted/60">
			<button
				type="button"
				aria-pressed={todo.done}
				aria-label={todo.done ? t`Mark as not done` : t`Mark as done`}
				onClick={() => toggleTodo(conversationId, todo.id)}
				className={cn(
					"flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
					todo.done
						? "border-primary bg-primary text-primary-foreground"
						: "border-muted-foreground/50 hover:border-foreground",
				)}
			>
				{todo.done && <LuCheck className="size-2.5" strokeWidth={3} />}
			</button>
			{draft !== null ? (
				<input
					// biome-ignore lint/a11y/noAutofocus: the user just asked to edit this item
					autoFocus
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter") commit();
						if (event.key === "Escape") setDraft(null);
					}}
					className="h-5 min-w-0 flex-1 rounded-sm bg-background px-1 text-xs outline-none ring-1 ring-ring"
				/>
			) : (
				<button
					type="button"
					onClick={() => setDraft(todo.text)}
					title={t`Click to edit`}
					className={cn(
						"min-w-0 flex-1 truncate text-left text-xs",
						todo.done && "text-muted-foreground line-through",
					)}
				>
					{todo.text}
				</button>
			)}
			<button
				type="button"
				aria-label={t`Delete to-do`}
				onClick={() => removeTodo(conversationId, todo.id)}
				className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/todo:opacity-100"
			>
				<LuX className="size-3" />
			</button>
		</li>
	);
}

/** The user's checklist for one conversation: add, edit, check, delete, clear. */
export function ConversationTodos({
	conversationId,
}: {
	conversationId: string;
}) {
	const { t } = useLingui();
	const todos = useConversationTodosStore(
		(state) => state.todosByConversation[conversationId] ?? EMPTY,
	);
	const addTodo = useConversationTodosStore((state) => state.addTodo);
	const clearDone = useConversationTodosStore((state) => state.clearDone);
	const [text, setText] = useState("");
	const doneCount = todos.filter((todo) => todo.done).length;

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		addTodo(conversationId, text);
		setText("");
	};

	return (
		<div className="ml-[7px] border-l border-border pb-1 pl-2.5">
			{todos.length > 0 && (
				<ul className="flex flex-col">
					{todos.map((todo) => (
						<TodoItem
							key={todo.id}
							conversationId={conversationId}
							todo={todo}
						/>
					))}
				</ul>
			)}
			<div className="flex h-6 items-center gap-1.5">
				<input
					value={text}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={t`Add a to-do…`}
					className="h-5 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring"
				/>
				{doneCount > 0 && (
					<button
						type="button"
						onClick={() => clearDone(conversationId)}
						className="shrink-0 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						{t`Clear ${doneCount} done`}
					</button>
				)}
			</div>
		</div>
	);
}

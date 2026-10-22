import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { type ClipboardEvent, type KeyboardEvent, useState } from "react";
import { parseNoteLines, reportNoteError } from "./notes";
import type { NoteActions } from "./useWorkspaceNotes";

/** Adds a note on Enter; pasting several lines adds one note per line. */
export function NoteInput({
	actions,
	className,
}: {
	actions: NoteActions;
	className?: string;
}) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const failed = t`Could not add the notes`;

	const add = (texts: string[]) => {
		if (texts.length > 0) reportNoteError(actions.add(texts), failed);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		add(parseNoteLines(text));
		setText("");
	};

	const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
		const pasted = event.clipboardData.getData("text/plain");
		if (!/\r?\n/.test(pasted.trim())) return;
		event.preventDefault();
		add(parseNoteLines(`${text}\n${pasted}`));
		setText("");
	};

	return (
		<input
			value={text}
			onChange={(event) => setText(event.target.value)}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			placeholder={t`Add or paste notes…`}
			title={t`Pasting several lines adds one note per line`}
			className={cn(
				"h-5 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-ring",
				className,
			)}
		/>
	);
}

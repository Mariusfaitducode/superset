import { useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Textarea } from "@superset/ui/textarea";
import { useState } from "react";
import type { WorkspaceIdea } from "./ideas";

/** An idea's note and its delete button, in the idea's menu. */
export function IdeaDetails({
	idea,
	onNoteChange,
	onDelete,
}: {
	idea: WorkspaceIdea;
	onNoteChange: (note: string | null) => void;
	onDelete: () => void;
}) {
	const { t } = useLingui();
	const [note, setNote] = useState(idea.note ?? "");
	const commitNote = () => {
		const next = note.trim() || null;
		if (next !== idea.note) onNoteChange(next);
	};

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="text-[11px] text-muted-foreground">{t`Note`}</p>
				<Textarea
					value={note}
					placeholder={t`Why, how, links…`}
					onChange={(event) => setNote(event.target.value)}
					onBlur={commitNote}
					className="max-h-48 min-h-16 text-xs"
				/>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onDelete}
				className="h-7 w-full text-xs text-red-500 hover:text-red-500"
			>
				{t`Delete idea`}
			</Button>
		</div>
	);
}

import { useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Textarea } from "@superset/ui/textarea";
import { useState } from "react";
import type { WorkspaceNote } from "./notes";

/** A note's details and its delete button, in the note's menu. */
export function NoteDetails({
	note,
	onDetailsChange,
	onDelete,
}: {
	note: WorkspaceNote;
	onDetailsChange: (details: string | null) => void;
	onDelete: () => void;
}) {
	const { t } = useLingui();
	const [details, setDetails] = useState(note.details ?? "");
	const commitDetails = () => {
		const next = details.trim() || null;
		if (next !== note.details) onDetailsChange(next);
	};

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="text-[11px] text-muted-foreground">{t`Details`}</p>
				<Textarea
					value={details}
					placeholder={t`Why, how, links…`}
					onChange={(event) => setDetails(event.target.value)}
					onBlur={commitDetails}
					className="max-h-48 min-h-16 text-xs"
				/>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onDelete}
				className="h-7 w-full text-xs text-red-500 hover:text-red-500"
			>
				{t`Delete note`}
			</Button>
		</div>
	);
}

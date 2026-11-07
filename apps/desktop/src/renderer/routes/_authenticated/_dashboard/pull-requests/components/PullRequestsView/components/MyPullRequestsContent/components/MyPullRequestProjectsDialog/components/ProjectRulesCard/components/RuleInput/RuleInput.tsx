import { Input } from "@superset/ui/input";
import { useEffect, useId, useState } from "react";

/** Text saved on blur, so a comma being typed is not parsed away. */
export function RuleInput({
	value,
	label,
	placeholder,
	onCommit,
	className,
}: {
	value: string;
	label: string;
	placeholder?: string;
	onCommit: (value: string) => void;
	className?: string;
}) {
	const id = useId();
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<label htmlFor={id} className="flex items-center gap-2 text-xs">
			<span className="w-20 shrink-0 text-muted-foreground">{label}</span>
			<Input
				id={id}
				value={draft}
				placeholder={placeholder}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (draft !== value) onCommit(draft);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
				className={className ?? "h-7 text-xs"}
			/>
		</label>
	);
}

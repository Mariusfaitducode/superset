import { ToggleGroup, ToggleGroupItem } from "@superset/ui/toggle-group";

interface SegmentedProps<Value extends string> {
	id?: string;
	value: Value;
	options: { value: Value; label: string }[];
	onChange: (value: Value) => void;
}

export function Segmented<Value extends string>({
	id,
	value,
	options,
	onChange,
}: SegmentedProps<Value>) {
	return (
		<ToggleGroup
			id={id}
			type="single"
			size="sm"
			value={value}
			onValueChange={(next) => {
				if (next) onChange(next as Value);
			}}
			className="rounded-md bg-muted/50 p-0.5"
		>
			{options.map((option) => (
				<ToggleGroupItem
					key={option.value}
					value={option.value}
					className="h-6 px-2.5 text-xs text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

import type { ReactNode } from "react";

export function InsightsSection({
	title,
	children,
}: {
	title: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h2>
			{children}
		</section>
	);
}

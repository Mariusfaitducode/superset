import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { PAGE_WIDTH, type PageWidth } from "./constants";

interface PageBodyProps {
	width?: PageWidth;
	className?: string;
	children: ReactNode;
}

/** The centered content column under a page's `PageHeader`. */
export function PageBody({
	width = "reading",
	className,
	children,
}: PageBodyProps) {
	return (
		<div
			className={cn(
				"mx-auto flex w-full flex-col px-8 pt-4 pb-12",
				PAGE_WIDTH[width],
				className,
			)}
		>
			{children}
		</div>
	);
}

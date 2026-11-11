/** Content column widths: `reading` for text and forms, `wide` for tables and charts. */
export const PAGE_WIDTH = {
	reading: "max-w-4xl",
	wide: "max-w-5xl",
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

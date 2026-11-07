import { expect, test } from "bun:test";
import { parseProcessTable, subtreeRssBytes } from "./process-table";

test("sums RSS over a terminal's whole process subtree", () => {
	const table = parseProcessTable(
		[
			"    1     0   1000",
			"  100     1    200",
			"  101   100   3000",
			"  102   101    500",
			"  200     1   9999",
			"bogus line",
			"",
		].join("\n"),
	);
	expect(subtreeRssBytes(table, 100)).toBe((200 + 3000 + 500) * 1024);
	expect(subtreeRssBytes(table, 200)).toBe(9999 * 1024);
	expect(subtreeRssBytes(table, 404)).toBe(0);
});

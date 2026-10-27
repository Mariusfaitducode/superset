import { describe, expect, test } from "bun:test";
import { extractTicketLinks } from "./ticket-links";

describe("extractTicketLinks", () => {
	test("takes the line label of a bare Notion link", () => {
		expect(
			extractTicketLinks(
				"## Summary\n\n- Spec: https://app.notion.com/p/401931da8c098181bb40cd8b9c980297\n",
			),
		).toEqual([
			{
				source: "notion",
				url: "https://app.notion.com/p/401931da8c098181bb40cd8b9c980297",
				title: "Spec",
			},
		]);
	});

	test("prefers the markdown text, then a title read from the URL", () => {
		expect(
			extractTicketLinks(
				"See [Lot form](https://www.notion.so/acme/Lot-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d) and https://www.notion.so/acme/Correct-the-lot-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6e.",
			).map((link) => link.title),
		).toEqual(["Lot form", "Correct the lot"]);
	});

	test("reads Linear and Jira keys and skips other links", () => {
		expect(
			extractTicketLinks(
				"https://github.com/acme/web/pull/3\nhttps://linear.app/acme/issue/eng-42/fix-it\nhttps://acme.atlassian.net/browse/OPS-7\nhttps://linear.app/acme/project/x",
			),
		).toEqual([
			{
				source: "linear",
				url: "https://linear.app/acme/issue/eng-42/fix-it",
				title: "ENG-42",
			},
			{
				source: "jira",
				url: "https://acme.atlassian.net/browse/OPS-7",
				title: "OPS-7",
			},
		]);
	});

	test("dedupes and caps the list", () => {
		const url = "https://app.notion.com/p/401931da8c098181bb40cd8b9c980297";
		expect(extractTicketLinks(`${url}\n${url}`)).toHaveLength(1);
		expect(
			extractTicketLinks(
				["a", "b", "c", "d"]
					.map((id) => `https://linear.app/x/issue/${id}-1`)
					.join("\n"),
			),
		).toHaveLength(3);
		expect(extractTicketLinks(null)).toEqual([]);
	});
});

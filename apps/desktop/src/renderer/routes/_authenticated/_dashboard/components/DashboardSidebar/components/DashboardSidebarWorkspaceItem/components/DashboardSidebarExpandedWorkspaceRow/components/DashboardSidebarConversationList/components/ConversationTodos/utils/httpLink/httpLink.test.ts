import { describe, expect, test } from "bun:test";
import { httpLink } from "./httpLink";

describe("httpLink", () => {
	test("keeps http and https links", () => {
		expect(httpLink("https://github.com/a/b/pull/1")).toBe(
			"https://github.com/a/b/pull/1",
		);
		expect(httpLink("http://localhost:3000/")).toBe("http://localhost:3000/");
	});

	test("drops other schemes and text that is not a URL", () => {
		expect(httpLink("javascript:alert(1)")).toBeNull();
		expect(httpLink("file:///etc/passwd")).toBeNull();
		expect(httpLink("not a url")).toBeNull();
		expect(httpLink(null)).toBeNull();
	});
});

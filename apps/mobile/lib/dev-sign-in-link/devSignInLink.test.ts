import { describe, expect, test } from "bun:test";
import { devSignInTokenFromUrl } from "./devSignInLink";

describe("devSignInTokenFromUrl", () => {
	test("reads the token from the dev sign-in link", () => {
		expect(devSignInTokenFromUrl("superset://dev-sign-in?token=a-b_C9")).toBe(
			"a-b_C9",
		);
		expect(devSignInTokenFromUrl("/dev-sign-in?x=1&token=abc")).toBe("abc");
	});

	test("refuses other links and malformed tokens", () => {
		expect(devSignInTokenFromUrl("superset://v2-workspace/ws-1")).toBe(null);
		expect(devSignInTokenFromUrl("superset://dev-sign-in-x?token=abc")).toBe(
			null,
		);
		expect(
			devSignInTokenFromUrl("https://evil.example/dev-sign-in?token=abc"),
		).toBe(null);
		expect(devSignInTokenFromUrl("superset://dev-sign-in?token=")).toBe(null);
		expect(devSignInTokenFromUrl("superset://dev-sign-in?token=a%20b")).toBe(
			null,
		);
	});
});

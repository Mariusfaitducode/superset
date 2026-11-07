import { describe, expect, test } from "bun:test";
import { parseRelaisMessage, RELAIS_ORIGIN } from "./relais-bridge";

const frame = {} as Window;

describe("parseRelaisMessage", () => {
	test("accepts an open request from the Relais frame", () => {
		expect(
			parseRelaisMessage(
				{
					origin: RELAIS_ORIGIN,
					source: frame,
					data: { type: "relais:open-workspace", workspaceId: "b43e1a3c-a711" },
				},
				frame,
			),
		).toEqual({ type: "relais:open-workspace", workspaceId: "b43e1a3c-a711" });
	});

	test("ignores other origins and other windows", () => {
		const data = { type: "relais:ready" };
		expect(
			parseRelaisMessage(
				{ origin: "https://evil.example", source: frame, data },
				frame,
			),
		).toBeNull();
		expect(
			parseRelaisMessage(
				{ origin: RELAIS_ORIGIN, source: {} as Window, data },
				frame,
			),
		).toBeNull();
	});

	test("rejects malformed workspace ids", () => {
		expect(
			parseRelaisMessage(
				{
					origin: RELAIS_ORIGIN,
					source: frame,
					data: { type: "relais:open-workspace", workspaceId: "../settings" },
				},
				frame,
			),
		).toBeNull();
	});
});

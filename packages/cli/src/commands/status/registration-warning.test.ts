import { describe, expect, test } from "bun:test";
import { registrationWarning } from "./registration-warning";

const organizationName = "Acme";

describe("registrationWarning", () => {
	test("says nothing for a registered host", () => {
		expect(
			registrationWarning({
				health: { healthy: true, cloudRegistered: true },
				cloudRegistered: true,
				organizationName,
			}),
		).toBe("");
	});

	test("says nothing when registration is unknown", () => {
		expect(
			registrationWarning({
				health: { healthy: true },
				cloudRegistered: undefined,
				organizationName,
			}),
		).toBe("");
	});

	test("blames remote access, not a crash, when the host never tries", () => {
		const warning = registrationWarning({
			health: {
				healthy: true,
				cloudRegistered: false,
				registrationError: null,
				cloudConnectEnabled: false,
			},
			cloudRegistered: false,
			organizationName,
		});
		expect(warning).toContain("remote access is off");
		expect(warning).not.toContain("superset stop");
	});

	test("keeps the restart hint when registration was attempted and failed", () => {
		const warning = registrationWarning({
			health: {
				healthy: true,
				cloudRegistered: false,
				registrationError: "fetch failed",
				cloudConnectEnabled: true,
			},
			cloudRegistered: false,
			organizationName,
		});
		expect(warning).toContain("(fetch failed)");
		expect(warning).toContain("superset stop && superset start");
	});
});

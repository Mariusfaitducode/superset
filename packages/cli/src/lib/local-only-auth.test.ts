import { afterEach, describe, expect, test } from "bun:test";
import { LOCAL_HOST_COMMANDS, localOnlyAuth } from "./local-only-auth";

const saved = process.env.SUPERSET_ORGANIZATION_ID;

afterEach(() => {
	if (saved === undefined) delete process.env.SUPERSET_ORGANIZATION_ID;
	else process.env.SUPERSET_ORGANIZATION_ID = saved;
});

describe("localOnlyAuth", () => {
	test("covers only the commands that talk to the local host", () => {
		expect([...LOCAL_HOST_COMMANDS].sort()).toEqual([
			"labels",
			"todos",
			"track",
			"tracks",
		]);
	});

	test("takes the organization of the terminal it runs in", () => {
		process.env.SUPERSET_ORGANIZATION_ID = "org-from-terminal";
		const auth = localOnlyAuth();
		expect(auth.config.organizationId).toBe("org-from-terminal");
		expect(auth.bearer).toBe("");
	});
});

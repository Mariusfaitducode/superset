import { expect, test } from "bun:test";
import { buildHostsWakeCommand } from "./buildHostsWakeCommand";

test("wakes the host by id, signed in to the organization, without a prompt", () => {
	const command = buildHostsWakeCommand("machine 1", "org-1");
	expect(command).toContain("export SUPERSET_ORGANIZATION_ID=org-1");
	expect(
		command.endsWith("superset hosts wake --org org-1 --yes 'machine 1'"),
	).toBe(true);
});

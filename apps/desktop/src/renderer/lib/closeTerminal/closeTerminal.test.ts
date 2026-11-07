import { describe, expect, it } from "bun:test";
import { closeTerminal } from "./closeTerminal";

function fakeClient(list: () => Promise<unknown>) {
	const calls: string[] = [];
	const client = {
		panes: {
			list: { query: list },
			close: {
				mutate: async ({ paneId }: { paneId: string }) => {
					calls.push(`panes.close ${paneId}`);
				},
			},
		},
		terminal: {
			killSession: {
				mutate: async ({ terminalId }: { terminalId: string }) => {
					calls.push(`terminal.killSession ${terminalId}`);
				},
			},
		},
	};
	return {
		client: client as unknown as Parameters<typeof closeTerminal>[0],
		calls,
	};
}

const layout = {
	layout: {
		tabs: [{ panes: [{ id: "pane-1", terminalId: "term-1" }] }],
	},
};

describe("closeTerminal", () => {
	it("closes the pane that shows the terminal", async () => {
		const { client, calls } = fakeClient(async () => layout);
		await closeTerminal(client, "ws", "term-1");
		expect(calls).toEqual(["panes.close pane-1"]);
	});

	it("kills the terminal when no pane shows it", async () => {
		const { client, calls } = fakeClient(async () => layout);
		await closeTerminal(client, "ws", "term-2");
		expect(calls).toEqual(["terminal.killSession term-2"]);
	});

	it("kills the terminal when the workspace has no layout", async () => {
		const { client, calls } = fakeClient(async () => {
			throw new Error("no layout");
		});
		await closeTerminal(client, "ws", "term-1");
		expect(calls).toEqual(["terminal.killSession term-1"]);
	});
});

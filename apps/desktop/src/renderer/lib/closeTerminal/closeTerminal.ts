import type { HostServiceClient } from "renderer/lib/host-service-client";

/**
 * Closing the pane is what the user would do by hand: the pane leaves the
 * layout and the terminal gets SIGHUP, which an idle `claude` obeys. A
 * terminal no pane shows is killed directly.
 */
export async function closeTerminal(
	client: Pick<HostServiceClient, "panes" | "terminal">,
	workspaceId: string,
	terminalId: string,
): Promise<void> {
	try {
		const { layout } = await client.panes.list.query({ workspaceId });
		const pane = layout.tabs
			.flatMap((tab) => tab.panes)
			.find((candidate) => candidate.terminalId === terminalId);
		if (pane) {
			await client.panes.close.mutate({ workspaceId, paneId: pane.id });
			return;
		}
	} catch {
		// No layout for this workspace, or the close failed: kill the terminal.
	}
	await client.terminal.killSession.mutate({ workspaceId, terminalId });
}

/**
 * The name the user gave the session wins; then the tab's name, unless it is
 * only the agent's own label that launches put on new tabs; then the title
 * the agent sets as the topic changes. With synced names the agent's title
 * comes before the tab's name, the order the terminal tab uses.
 */
export function pickConversationTitle({
	customTitle,
	tabName,
	runtimeTitle,
	agentLabel,
	syncNames = false,
}: {
	customTitle: string | null;
	tabName: string | null;
	runtimeTitle: string | null;
	agentLabel: string;
	syncNames?: boolean;
}): string {
	const isAgentLabel =
		tabName?.toLocaleLowerCase() === agentLabel.toLocaleLowerCase();
	const name = isAgentLabel ? null : tabName;
	return syncNames
		? (customTitle ?? runtimeTitle ?? name ?? agentLabel)
		: (customTitle ?? name ?? runtimeTitle ?? agentLabel);
}

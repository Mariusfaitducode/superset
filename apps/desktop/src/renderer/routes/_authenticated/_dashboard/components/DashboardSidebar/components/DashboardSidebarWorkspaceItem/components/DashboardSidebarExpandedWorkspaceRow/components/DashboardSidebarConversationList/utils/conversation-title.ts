/**
 * The name the user gave the session wins; then the tab's name, unless it is
 * only the agent's own label that launches put on new tabs; then the title
 * the agent sets as the topic changes.
 */
export function pickConversationTitle({
	customTitle,
	tabName,
	runtimeTitle,
	agentLabel,
}: {
	customTitle: string | null;
	tabName: string | null;
	runtimeTitle: string | null;
	agentLabel: string;
}): string {
	const isAgentLabel =
		tabName?.toLocaleLowerCase() === agentLabel.toLocaleLowerCase();
	return (
		customTitle ?? (isAgentLabel ? null : tabName) ?? runtimeTitle ?? agentLabel
	);
}

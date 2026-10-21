import { CLIError } from "@superset/cli-framework";

export interface Label {
	id: string;
	name: string;
	color: string;
}

export function labelWorkspace(
	flag: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const workspaceId = flag ?? env.SUPERSET_WORKSPACE_ID;
	if (!workspaceId) {
		throw new CLIError(
			"No workspace to label",
			"Run it from a workspace's terminal, or pass --workspace.",
		);
	}
	return workspaceId;
}

/** Labels are made in the app; the CLI only puts existing ones on. */
export function findLabels(names: string[], labels: Label[]): Label[] {
	return names.map((name) => {
		const wanted = name.trim().toLocaleLowerCase();
		const label = labels.find(
			(item) => item.name.toLocaleLowerCase() === wanted,
		);
		if (!label) {
			throw new CLIError(
				`No label named ${name}`,
				`Labels: ${labels.map((item) => item.name).join(", ")}`,
			);
		}
		return label;
	});
}

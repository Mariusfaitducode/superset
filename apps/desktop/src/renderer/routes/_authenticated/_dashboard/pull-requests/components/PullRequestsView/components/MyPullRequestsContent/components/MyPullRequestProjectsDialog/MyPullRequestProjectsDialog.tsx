import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { useState } from "react";
import { useMyPullRequestsStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import { ProjectRulesCard } from "./components/ProjectRulesCard";

interface MyPullRequestProjectsDialogProps {
	/** Project id → PRs it holds now. */
	counts: Map<string, number>;
	onClose: () => void;
}

/** Add, rename, reorder and delete projects, and edit the rules that fill them. */
export function MyPullRequestProjectsDialog({
	counts,
	onClose,
}: MyPullRequestProjectsDialogProps) {
	const { t } = useLingui();
	const {
		projects,
		addProject,
		renameProject,
		setProjectRules,
		moveProjectUp,
		deleteProject,
	} = useMyPullRequestsStore();
	const [newName, setNewName] = useState("");

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="flex max-h-[85vh] max-w-[560px] flex-col">
				<DialogHeader>
					<DialogTitle className="font-medium">
						<Trans>Projects</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							A pull request goes to the project you moved it to, else to the
							first project whose rules match: a PR number first, then a label,
							then a keyword. The rest goes to Other. Separate values with
							commas.
						</Trans>
					</DialogDescription>
				</DialogHeader>
				<div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
					{projects.map((project, index) => (
						<ProjectRulesCard
							key={project.id}
							project={project}
							count={counts.get(project.id) ?? 0}
							isFirst={index === 0}
							onRename={(name) => renameProject(project.id, name)}
							onChangeRules={(rules) => setProjectRules(project.id, rules)}
							onMoveUp={() => moveProjectUp(project.id)}
							onDelete={() => deleteProject(project.id)}
						/>
					))}
					{projects.length === 0 && (
						<span className="py-2 text-sm text-muted-foreground">
							<Trans>No project yet: every pull request is in Other.</Trans>
						</span>
					)}
				</div>
				<form
					className="flex items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						addProject(newName);
						setNewName("");
					}}
				>
					<Input
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						placeholder={t`New project name`}
						aria-label={t`New project name`}
						className="h-8 text-sm"
					/>
					<Button
						type="submit"
						size="sm"
						className="h-8 px-3 text-xs"
						disabled={!newName.trim()}
					>
						<Trans>Add project</Trans>
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

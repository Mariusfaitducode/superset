import { useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { LuArrowUp, LuTrash2 } from "react-icons/lu";
import type { PullRequestProjectRules } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import {
	type PullRequestProject,
	parseRuleList,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import { RuleInput } from "./components/RuleInput";

interface ProjectRulesCardProps {
	project: PullRequestProject;
	/** PRs in this project now, by rule or by hand. */
	count: number;
	isFirst: boolean;
	onRename: (name: string) => void;
	onChangeRules: (rules: Partial<PullRequestProjectRules>) => void;
	onMoveUp: () => void;
	onDelete: () => void;
}

/** One project: its name, its rules and how many PRs it holds now. */
export function ProjectRulesCard({
	project,
	count,
	isFirst,
	onRename,
	onChangeRules,
	onMoveUp,
	onDelete,
}: ProjectRulesCardProps) {
	const { t } = useLingui();
	const rule = (field: keyof PullRequestProjectRules) => (text: string) =>
		onChangeRules({ [field]: parseRuleList(text) });
	return (
		<div className="flex flex-col gap-1.5 rounded-md border p-2">
			<div className="flex items-center gap-1">
				<Input
					aria-label={t`Project name`}
					defaultValue={project.name}
					key={project.name}
					onBlur={(event) => onRename(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
					}}
					className="h-7 flex-1 font-medium text-sm"
				/>
				<span
					className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
					title={t`Pull requests in this project now`}
				>
					{count}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					disabled={isFirst}
					aria-label={t`Move ${project.name} up`}
					title={t`Move up`}
					onClick={onMoveUp}
				>
					<LuArrowUp className="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={t`Delete ${project.name}`}
					title={t`Delete`}
					onClick={onDelete}
				>
					<LuTrash2 className="size-3.5" />
				</Button>
			</div>
			<RuleInput
				label={t`Keywords`}
				value={project.keywords.join(", ")}
				placeholder={t`In the title or branch, e.g. audit trail, e-signature`}
				onCommit={rule("keywords")}
			/>
			<RuleInput
				label={t`Labels`}
				value={project.labels.join(", ")}
				placeholder={t`GitHub labels, e.g. spore-app-redesign`}
				onCommit={rule("labels")}
			/>
			<RuleInput
				label={t`Pull requests`}
				value={project.pullRequests.join(", ")}
				placeholder={t`e.g. #2701, spore-bio/hub#3025`}
				onCommit={rule("pullRequests")}
			/>
		</div>
	);
}

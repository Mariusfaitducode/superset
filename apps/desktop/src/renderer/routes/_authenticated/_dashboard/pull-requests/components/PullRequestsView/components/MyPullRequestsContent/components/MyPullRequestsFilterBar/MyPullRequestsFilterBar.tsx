import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { LuChevronDown, LuFolderGit2, LuListOrdered } from "react-icons/lu";
import {
	type MyPullRequestGrouping,
	useMyPullRequestsStore,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/myPullRequestsStore";
import {
	MY_PULL_REQUEST_AGES,
	MY_PULL_REQUEST_ROLES,
	MY_PULL_REQUEST_STATES,
	type MyPullRequestAgeFilter,
	type MyPullRequestFacetCounts,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/filterMyPullRequests";
import {
	ageLabels,
	roleLabels,
	stateLabels,
} from "../../utils/myPullRequestLabels";

function Count({ value }: { value: number }) {
	return (
		<span className="ml-auto pl-3 text-muted-foreground tabular-nums">
			{value}
		</span>
	);
}

function FacetMenu({
	label,
	selected,
	children,
}: {
	label: string;
	selected: string | null;
	children: ReactNode;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="xs"
					className={cn(
						"h-6 gap-1 px-2 text-xs font-normal text-muted-foreground",
						selected && "bg-accent text-foreground",
					)}
				>
					{label}
					{selected && <span className="font-medium">{selected}</span>}
					<LuChevronDown className="size-3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-48">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Repo, role, state and age filters; each option shows how many PRs it keeps. */
export function MyPullRequestsFilterBar({
	counts,
}: {
	counts: MyPullRequestFacetCounts;
}) {
	const { t } = useLingui();
	const {
		repos,
		roles,
		states,
		age,
		setRepos,
		toggleRole,
		toggleState,
		setAge,
		clearFilters,
		groupBy,
		setGroupBy,
	} = useMyPullRequestsStore();
	const groupings: {
		value: MyPullRequestGrouping;
		label: string;
		icon: ReactNode;
	}[] = [
		{
			value: "action",
			label: t`Next action`,
			icon: <LuListOrdered className="size-3" />,
		},
		{
			value: "project",
			label: t`Project`,
			icon: <LuFolderGit2 className="size-3" />,
		},
	];
	const roleLabel = roleLabels();
	const stateLabel = stateLabels();
	const ageLabel = ageLabels();
	// Keep a selected repo listed even when nothing matches it any more.
	const repoOptions = [...new Set([...counts.repos.keys(), ...repos])].sort();
	const summarize = (values: string[]) =>
		values.length === 0
			? null
			: values.length === 1
				? (values[0] ?? null)
				: String(values.length);
	const hasFilters =
		repos.length > 0 || roles.length > 0 || states.length > 0 || age !== "any";

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-3 py-1">
			{repoOptions.length > 1 && (
				<FacetMenu
					label={t`Repo`}
					selected={summarize(repos.map((repo) => repo.split("/")[1] ?? repo))}
				>
					{repoOptions.map((repo) => (
						<DropdownMenuCheckboxItem
							key={repo}
							checked={repos.includes(repo)}
							onCheckedChange={() =>
								setRepos(
									repos.includes(repo)
										? repos.filter((item) => item !== repo)
										: [...repos, repo],
								)
							}
							onSelect={(event) => event.preventDefault()}
						>
							{repo}
							<Count value={counts.repos.get(repo) ?? 0} />
						</DropdownMenuCheckboxItem>
					))}
				</FacetMenu>
			)}
			<FacetMenu
				label={t`Role`}
				selected={summarize(roles.map((role) => roleLabel[role]))}
			>
				{MY_PULL_REQUEST_ROLES.map((role) => (
					<DropdownMenuCheckboxItem
						key={role}
						checked={roles.includes(role)}
						onCheckedChange={() => toggleRole(role)}
						onSelect={(event) => event.preventDefault()}
					>
						{roleLabel[role]}
						<Count value={counts.roles[role]} />
					</DropdownMenuCheckboxItem>
				))}
			</FacetMenu>
			<FacetMenu
				label={t`State`}
				selected={summarize(states.map((state) => stateLabel[state]))}
			>
				{MY_PULL_REQUEST_STATES.map((state) => (
					<DropdownMenuCheckboxItem
						key={state}
						checked={states.includes(state)}
						onCheckedChange={() => toggleState(state)}
						onSelect={(event) => event.preventDefault()}
					>
						{stateLabel[state]}
						<Count value={counts.states[state]} />
					</DropdownMenuCheckboxItem>
				))}
			</FacetMenu>
			<FacetMenu label={t`Age`} selected={age === "any" ? null : ageLabel[age]}>
				<DropdownMenuRadioGroup
					value={age}
					onValueChange={(value) => setAge(value as MyPullRequestAgeFilter)}
				>
					{MY_PULL_REQUEST_AGES.map((option) => (
						<DropdownMenuRadioItem key={option} value={option}>
							{ageLabel[option]}
							<Count value={counts.age[option]} />
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</FacetMenu>
			{hasFilters && (
				<Button
					variant="ghost"
					size="xs"
					className="h-6 px-2 text-xs font-normal text-muted-foreground"
					onClick={clearFilters}
				>
					<Trans>Clear</Trans>
				</Button>
			)}
			<fieldset className="ml-auto flex items-center gap-0.5 rounded-md border p-0.5">
				<legend className="sr-only">{t`Group by`}</legend>
				{groupings.map((grouping) => (
					<Button
						key={grouping.value}
						variant="ghost"
						size="xs"
						aria-pressed={groupBy === grouping.value}
						title={t`Group by ${grouping.label}`}
						className={cn(
							"h-5 gap-1 px-1.5 text-xs font-normal text-muted-foreground",
							groupBy === grouping.value && "bg-accent text-foreground",
						)}
						onClick={() => setGroupBy(grouping.value)}
					>
						{grouping.icon}
						{grouping.label}
					</Button>
				))}
			</fieldset>
		</div>
	);
}

import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import { useMemo, useState } from "react";
import {
	LuBot,
	LuCheck,
	LuChevronDown,
	LuFolderGit2,
	LuGitBranch,
	LuTag,
} from "react-icons/lu";

export interface RefOption {
	/** Full ref name. */
	ref: string;
	label: string;
	kind: "branch" | "remote" | "tag";
	committedAt: number;
	hasWorktree: boolean;
	conversationTitle: string | null;
}

// Big repos carry thousands of remote branches; the search finds the rest.
const MAX_PER_SECTION = 80;

/** Pick the branches and tags the graph walks from. Empty = every branch. */
export function GitGraphRefFilter({
	options,
	selected,
	onChange,
}: {
	options: RefOption[];
	selected: string[];
	onChange: (refs: string[]) => void;
}) {
	const { t } = useLingui();
	const [query, setQuery] = useState("");
	const selectedSet = useMemo(() => new Set(selected), [selected]);

	const sections = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const matching = options
			.filter(
				(option) => !needle || option.label.toLowerCase().includes(needle),
			)
			.sort((a, b) => b.committedAt - a.committedAt);
		const pick = (predicate: (option: RefOption) => boolean) => {
			const all = matching.filter(predicate);
			return {
				shown: all.slice(0, MAX_PER_SECTION),
				hidden: Math.max(0, all.length - MAX_PER_SECTION),
			};
		};
		return [
			{
				title: t`Worktrees and conversations`,
				...pick(
					(option) =>
						option.kind === "branch" &&
						(option.hasWorktree || !!option.conversationTitle),
				),
			},
			{
				title: t`Local branches`,
				...pick(
					(option) =>
						option.kind === "branch" &&
						!option.hasWorktree &&
						!option.conversationTitle,
				),
			},
			{
				title: t`Remote branches`,
				...pick((option) => option.kind === "remote"),
			},
			{ title: t`Tags`, ...pick((option) => option.kind === "tag") },
		];
	}, [options, query, t]);

	const toggle = (ref: string) =>
		onChange(
			selectedSet.has(ref)
				? selected.filter((item) => item !== ref)
				: [...selected, ref],
		);
	const label =
		selected.length === 0
			? t`All branches`
			: selected.length === 1
				? (options.find((option) => option.ref === selected[0])?.label ??
					selected[0]?.replace(/^refs\/(heads|remotes|tags)\//, ""))
				: t`${selected.length} refs`;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"h-7 max-w-72 justify-between gap-1.5 px-2 text-xs font-normal",
						selected.length > 0 && "border-primary/50",
					)}
				>
					<LuGitBranch className="size-3.5 shrink-0" />
					<span className="truncate">{label}</span>
					<LuChevronDown className="size-3 shrink-0 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-0">
				<div className="flex items-center gap-2 border-b p-2">
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t`Search branches and tags`}
						className="h-7 text-xs"
					/>
					{selected.length > 0 && (
						<Button
							variant="ghost"
							size="xs"
							className="h-7 shrink-0 px-2 text-xs"
							onClick={() => onChange([])}
						>
							<Trans>Show all</Trans>
						</Button>
					)}
				</div>
				<div className="max-h-96 overflow-y-auto p-1">
					{sections.map(
						(section) =>
							section.shown.length > 0 && (
								<div key={section.title} className="pb-1">
									<div className="px-2 pt-1.5 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
										{section.title}
									</div>
									{section.shown.map((option) => (
										<button
											key={option.ref}
											type="button"
											className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
											onClick={() => toggle(option.ref)}
										>
											<LuCheck
												className={cn(
													"size-3.5 shrink-0",
													!selectedSet.has(option.ref) && "invisible",
												)}
											/>
											{option.kind === "tag" ? (
												<LuTag className="size-3 shrink-0 text-muted-foreground" />
											) : option.hasWorktree ? (
												<LuFolderGit2 className="size-3 shrink-0 text-muted-foreground" />
											) : (
												<LuGitBranch className="size-3 shrink-0 text-muted-foreground" />
											)}
											<span className="min-w-0 flex-1 truncate">
												{option.label}
											</span>
											{option.conversationTitle && (
												<span
													className="flex min-w-0 max-w-32 shrink items-center gap-1 text-muted-foreground"
													title={option.conversationTitle}
												>
													<LuBot className="size-3 shrink-0" />
													<span className="truncate">
														{option.conversationTitle}
													</span>
												</span>
											)}
										</button>
									))}
									{section.hidden > 0 && (
										<div className="px-2 py-1 text-[11px] text-muted-foreground">
											<Trans>{section.hidden} more, refine the search</Trans>
										</div>
									)}
								</div>
							),
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

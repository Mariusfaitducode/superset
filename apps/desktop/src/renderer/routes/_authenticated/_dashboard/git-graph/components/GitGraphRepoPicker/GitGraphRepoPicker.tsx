import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { useState } from "react";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { ProjectThumbnail } from "renderer/routes/_authenticated/components/ProjectThumbnail";

export interface GitGraphRepo {
	projectId: string;
	name: string;
	iconUrl: string | null;
	color: string | null;
	repoPath: string | null;
	/** A reachable host serves it, so its history can be read. */
	available: boolean;
	isRecent: boolean;
}

/** Pick the repository whose graph is shown; recent ones come first. */
export function GitGraphRepoPicker({
	repos,
	value,
	onChange,
}: {
	repos: GitGraphRepo[];
	value: string | null;
	onChange: (projectId: string) => void;
}) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const selected = repos.find((repo) => repo.projectId === value) ?? null;
	const recent = repos.filter((repo) => repo.isRecent);
	const others = repos.filter((repo) => !repo.isRecent);

	const item = (repo: GitGraphRepo) => (
		<CommandItem
			key={repo.projectId}
			value={`${repo.name} ${repo.projectId}`}
			keywords={repo.repoPath ? [repo.repoPath] : undefined}
			disabled={!repo.available}
			onSelect={() => {
				onChange(repo.projectId);
				setOpen(false);
			}}
			className="gap-2"
		>
			<ProjectThumbnail
				projectName={repo.name}
				iconUrl={repo.iconUrl}
				color={repo.color}
				className="size-5 text-[10px]"
			/>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-xs">{repo.name}</span>
				<span className="truncate text-[10px] text-muted-foreground">
					{repo.available
						? repo.repoPath
						: t`Not available on a connected host`}
				</span>
			</span>
			{repo.projectId === value && <LuCheck className="size-3.5 shrink-0" />}
		</CommandItem>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-7 max-w-64 gap-1.5 px-1.5 text-xs font-medium"
					title={selected?.repoPath ?? undefined}
				>
					{selected ? (
						<ProjectThumbnail
							projectName={selected.name}
							iconUrl={selected.iconUrl}
							color={selected.color}
							className="size-4 text-[9px]"
						/>
					) : null}
					<span className="truncate">
						{selected ? selected.name : <Trans>Choose a repository</Trans>}
					</span>
					<LuChevronDown className="size-3 shrink-0 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-0">
				<Command>
					<CommandInput
						placeholder={t`Search repositories`}
						className="h-8 text-xs"
					/>
					<CommandList className="max-h-80">
						<CommandEmpty>
							<Trans>No repository matches.</Trans>
						</CommandEmpty>
						{recent.length > 0 && (
							<CommandGroup heading={t`Recent`}>
								{recent.map(item)}
							</CommandGroup>
						)}
						{others.length > 0 && (
							<CommandGroup
								heading={recent.length > 0 ? t`All repositories` : undefined}
							>
								{others.map(item)}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

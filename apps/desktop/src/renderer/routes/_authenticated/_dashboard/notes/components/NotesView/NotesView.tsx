import { Trans, useLingui } from "@lingui/react/macro";
import { Input } from "@superset/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@superset/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { LuArrowRight, LuSearch } from "react-icons/lu";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	NoteInput,
	NoteItem,
	noteActions,
	useNotesByHost,
	type WorkspaceNote,
} from "../../../components/DashboardSidebar/components/WorkspaceNotes";
import { WorkspaceFilter } from "../../../pages/components/PagesView/components/WorkspaceFilter";
import {
	buildNoteGroups,
	type NotesStatusFilter,
	type NotesWorkspace,
} from "../../utils/noteGroups";

interface NotesViewProps {
	search: string;
	status: NotesStatusFilter;
	workspaceId: string | null;
	onSearchChange: (search: string) => void;
	onStatusChange: (status: NotesStatusFilter) => void;
	onWorkspaceChange: (workspaceId: string | null) => void;
}

/** Every workspace's notes on one page, filterable, each group one click from its workspace. */
export function NotesView({
	search,
	status,
	workspaceId,
	onSearchChange,
	onStatusChange,
	onWorkspaceChange,
}: NotesViewProps) {
	const { t } = useLingui();
	const { workspaces: hostWorkspaces, isReady } = useHostWorkspaces();
	const workspaces = useMemo<NotesWorkspace[]>(
		() =>
			hostWorkspaces
				.filter((workspace) => workspace.archivedAt == null)
				.map(({ id, hostId, name, branch }) => ({ id, hostId, name, branch })),
		[hostWorkspaces],
	);
	const hostNotes = useNotesByHost(workspaces.map((w) => w.hostId));
	const hostUrlById = useMemo(
		() => new Map(hostNotes.map((host) => [host.hostId, host.hostUrl])),
		[hostNotes],
	);
	const notes = useMemo(
		() => hostNotes.flatMap((host) => host.notes),
		[hostNotes],
	);

	const { groups, counts, workspaceOptions } = useMemo(
		() => buildNoteGroups(workspaces, notes, { status, workspaceId, search }),
		[workspaces, notes, status, workspaceId, search],
	);

	// A workspace opened from its sidebar panel stays here with no notes yet,
	// so the first ones can be added.
	const selected = workspaces.find((w) => w.id === workspaceId) ?? null;
	const shownGroups =
		selected &&
		!search.trim() &&
		!groups.some((group) => group.workspace.id === selected.id)
			? [{ workspace: selected, notes: [] }]
			: groups;
	const options =
		selected && !workspaceOptions.some((o) => o.workspaceId === selected.id)
			? [
					...workspaceOptions,
					{ workspaceId: selected.id, name: selected.name, count: 0 },
				]
			: workspaceOptions;

	const hasNotes = notes.some((note) =>
		workspaces.some((w) => w.id === note.workspaceId),
	);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-4 pb-12">
					<h1 className="font-semibold text-xl tracking-tight">
						<Trans>Notes</Trans>
					</h1>

					<div className="mt-6 flex flex-wrap items-center justify-between gap-2">
						<Tabs
							value={status}
							onValueChange={(value) =>
								onStatusChange(value as NotesStatusFilter)
							}
						>
							<TabsList className="h-8 gap-1 bg-transparent p-0">
								{(["open", "all"] as const).map((value) => (
									<TabsTrigger
										key={value}
										value={value}
										className="h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
									>
										<span className="text-sm">
											{value === "open"
												? t({ message: "Open", context: "note status" })
												: t`All`}
										</span>
										<span className="ml-1 text-muted-foreground text-xs tabular-nums">
											{counts[value]}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						<div className="flex items-center gap-2">
							{options.length > 0 && (
								<WorkspaceFilter
									value={workspaceId}
									options={options}
									onChange={onWorkspaceChange}
								/>
							)}
							<div className="relative w-56">
								<LuSearch className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) => onSearchChange(event.target.value)}
									placeholder={t`Search notes`}
									className="h-8 pl-7 text-sm"
								/>
							</div>
						</div>
					</div>

					<div className="mt-6 flex flex-col gap-6">
						{shownGroups.map((group) => (
							<NoteGroupSection
								key={group.workspace.id}
								workspace={group.workspace}
								hostUrl={hostUrlById.get(group.workspace.hostId) ?? null}
								notes={group.notes}
							/>
						))}
					</div>

					{shownGroups.length === 0 && isReady && (
						<p className="mt-12 text-center text-muted-foreground text-sm">
							{hasNotes ? (
								<Trans>No notes match these filters.</Trans>
							) : (
								<Trans>
									No notes yet. Add them from the note button on a workspace in
									the sidebar, or ask an agent to run superset notes add.
								</Trans>
							)}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function NoteGroupSection({
	workspace,
	hostUrl,
	notes,
}: {
	workspace: NotesWorkspace;
	hostUrl: string | null;
	notes: WorkspaceNote[];
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const actions = useMemo(
		() => noteActions(queryClient, hostUrl, workspace.id),
		[queryClient, hostUrl, workspace.id],
	);

	return (
		<section className="flex flex-col">
			<button
				type="button"
				onClick={() => navigateToV2Workspace(workspace.id, navigate)}
				title={t`Open the workspace`}
				className="group/workspace flex h-8 items-center gap-2 rounded-md px-1.5 text-left hover:bg-muted/60"
			>
				<span className="truncate font-medium text-sm">{workspace.name}</span>
				{workspace.branch !== workspace.name && (
					<span className="truncate text-muted-foreground text-xs">
						{workspace.branch}
					</span>
				)}
				<LuArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/workspace:opacity-100" />
			</button>
			{notes.length > 0 && (
				<ul className="flex flex-col">
					{notes.map((note) => (
						<NoteItem key={note.id} note={note} actions={actions} large />
					))}
				</ul>
			)}
			<div className="flex h-8 items-center px-1.5">
				<NoteInput actions={actions} className="h-6 text-sm" />
			</div>
		</section>
	);
}

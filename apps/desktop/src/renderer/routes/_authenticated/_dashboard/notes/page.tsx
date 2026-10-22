import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotesView } from "./components/NotesView";

export type NotesSearch = {
	q?: string;
	/** Omitted = only the open and kept notes. */
	status?: "all";
	workspace?: string;
};

export const Route = createFileRoute("/_authenticated/_dashboard/notes/")({
	component: NotesPage,
	validateSearch: (search: Record<string, unknown>): NotesSearch => ({
		q: typeof search.q === "string" && search.q ? search.q : undefined,
		status: search.status === "all" ? "all" : undefined,
		workspace:
			typeof search.workspace === "string" && search.workspace
				? search.workspace
				: undefined,
	}),
});

function NotesPage() {
	const { q, status, workspace } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<NotesView
			search={q ?? ""}
			status={status ?? "open"}
			workspaceId={workspace ?? null}
			onSearchChange={(value) =>
				navigate({
					search: (prev) => ({ ...prev, q: value || undefined }),
					replace: true,
				})
			}
			onStatusChange={(value) =>
				navigate({
					search: (prev) => ({
						...prev,
						status: value === "all" ? "all" : undefined,
					}),
					replace: true,
				})
			}
			onWorkspaceChange={(value) =>
				navigate({
					search: (prev) => ({ ...prev, workspace: value ?? undefined }),
					replace: true,
				})
			}
		/>
	);
}

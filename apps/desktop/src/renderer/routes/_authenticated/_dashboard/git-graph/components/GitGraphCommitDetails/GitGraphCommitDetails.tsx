import { Trans, useLingui } from "@lingui/react/macro";
import { formatDateTime } from "@superset/i18n/format";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { LuCopy, LuExternalLink, LuRefreshCw, LuX } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import type { GraphRowLayout } from "../../utils/layoutGitGraph";
import { GitGraphContinuation } from "../GitGraphCell";

export const COMMIT_DETAILS_HEIGHT = 260;

const STATUS_LETTER: Record<string, { letter: string; className: string }> = {
	added: { letter: "A", className: "text-green-500" },
	untracked: { letter: "A", className: "text-green-500" },
	copied: { letter: "C", className: "text-sky-500" },
	renamed: { letter: "R", className: "text-sky-500" },
	deleted: { letter: "D", className: "text-red-500" },
};
const MODIFIED = { letter: "M", className: "text-amber-500" };

/** The commit's details, opened under its row as in Git Graph. */
export function GitGraphCommitDetails({
	hostUrl,
	projectId,
	hash,
	row,
	graphWidth,
	repoUrl,
	onSelectHash,
	onClose,
}: {
	hostUrl: string;
	projectId: string;
	hash: string;
	row: GraphRowLayout;
	graphWidth: number;
	/** GitHub page of the repository, to link the commit. */
	repoUrl: string | null;
	onSelectHash: (hash: string) => void;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const openUrl = electronTrpc.external.openUrl.useMutation();
	const details = useQuery({
		queryKey: ["gitGraph", "commit", hostUrl, projectId, hash],
		queryFn: () =>
			getHostServiceClientByUrl(hostUrl).gitGraph.commit.query({
				projectId,
				hash,
			}),
		// A commit never changes.
		staleTime: Number.POSITIVE_INFINITY,
	});
	const data = details.data;
	const copy = (text: string) => void navigator.clipboard.writeText(text);

	return (
		<div
			className="flex border-y bg-muted/30 text-xs"
			style={{ height: COMMIT_DETAILS_HEIGHT }}
		>
			<div
				className="shrink-0 overflow-hidden pl-2"
				style={{ width: graphWidth }}
			>
				<GitGraphContinuation
					row={row}
					width={graphWidth}
					height={COMMIT_DETAILS_HEIGHT}
				/>
			</div>
			{!data ? (
				<div className="flex flex-1 items-center gap-2 p-3 text-muted-foreground">
					{details.error ? (
						<>
							<span className="cursor-text select-text text-destructive">
								{details.error.message}
							</span>
							<Button
								variant="outline"
								size="xs"
								onClick={() => void details.refetch()}
							>
								<Trans>Try again</Trans>
							</Button>
						</>
					) : (
						<>
							<LuRefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
							<Trans>Loading commit…</Trans>
						</>
					)}
				</div>
			) : (
				<>
					<div className="min-w-0 flex-1 cursor-text select-text overflow-y-auto p-3">
						<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
							<dt className="font-medium">
								<Trans>Commit</Trans>
							</dt>
							<dd className="flex min-w-0 items-center gap-1 font-mono">
								<span className="truncate">{data.hash}</span>
								<button
									type="button"
									className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
									aria-label={t`Copy hash`}
									title={t`Copy hash`}
									onClick={() => copy(data.hash)}
								>
									<LuCopy className="size-3" />
								</button>
								{repoUrl && (
									<button
										type="button"
										className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
										aria-label={t`Open on GitHub`}
										title={t`Open on GitHub`}
										onClick={() =>
											openUrl.mutate(`${repoUrl}/commit/${data.hash}`)
										}
									>
										<LuExternalLink className="size-3" />
									</button>
								)}
							</dd>
							<dt className="font-medium">
								<Trans>Parents</Trans>
							</dt>
							<dd className="flex flex-wrap gap-2 font-mono">
								{data.parents.length === 0 ? (
									<span className="font-sans text-muted-foreground">
										<Trans>None</Trans>
									</span>
								) : (
									data.parents.map((parent) => (
										<button
											key={parent}
											type="button"
											className="text-sky-600 hover:underline dark:text-sky-400"
											title={t`Go to ${parent}`}
											onClick={() => onSelectHash(parent)}
										>
											{parent.slice(0, 8)}
										</button>
									))
								)}
							</dd>
							<dt className="font-medium">
								<Trans>Author</Trans>
							</dt>
							<dd className="truncate">
								{data.authorName}{" "}
								<span className="text-muted-foreground">
									&lt;{data.authorEmail}&gt;
								</span>
							</dd>
							{(data.committerName !== data.authorName ||
								data.committerEmail !== data.authorEmail) && (
								<>
									<dt className="font-medium">
										<Trans>Committer</Trans>
									</dt>
									<dd className="truncate">
										{data.committerName}{" "}
										<span className="text-muted-foreground">
											&lt;{data.committerEmail}&gt;
										</span>
									</dd>
								</>
							)}
							<dt className="font-medium">
								<Trans>Date</Trans>
							</dt>
							<dd>{formatDateTime(data.authoredAt * 1000)}</dd>
						</dl>
						<p className="mt-3 whitespace-pre-wrap break-words">
							{data.message}
						</p>
					</div>
					<div className="flex w-[42%] min-w-0 shrink-0 flex-col border-l">
						<div className="flex shrink-0 items-center justify-between px-3 pt-2 pb-1">
							<span className="font-medium">
								<Trans>{data.files.length} files changed</Trans>
							</span>
							<button
								type="button"
								className="rounded p-0.5 text-muted-foreground hover:text-foreground"
								aria-label={t`Close details`}
								title={t`Close details (Esc)`}
								onClick={onClose}
							>
								<LuX className="size-3.5" />
							</button>
						</div>
						<ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
							{data.files.map((file) => {
								const status = STATUS_LETTER[file.status] ?? MODIFIED;
								const slash = file.path.lastIndexOf("/");
								return (
									<li key={file.path}>
										<button
											type="button"
											className="flex w-full items-center gap-2 rounded px-2 py-0.5 text-left hover:bg-accent"
											title={
												file.oldPath
													? t`${file.oldPath} → ${file.path} (click to copy)`
													: t`${file.path} (click to copy)`
											}
											onClick={() => copy(file.path)}
										>
											<span
												className={cn(
													"w-3 shrink-0 font-mono font-semibold",
													status.className,
												)}
											>
												{status.letter}
											</span>
											<span className="min-w-0 flex-1 truncate">
												{file.path.slice(slash + 1)}
												{slash > 0 && (
													<span className="ml-1.5 text-muted-foreground">
														{file.path.slice(0, slash)}
													</span>
												)}
											</span>
											{file.isBinary ? (
												<span className="shrink-0 text-muted-foreground">
													<Trans>binary</Trans>
												</span>
											) : (
												<span className="shrink-0 font-mono tabular-nums">
													<span className="text-green-500">
														+{file.additions ?? 0}
													</span>{" "}
													<span className="text-red-500">
														−{file.deletions ?? 0}
													</span>
												</span>
											)}
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				</>
			)}
		</div>
	);
}

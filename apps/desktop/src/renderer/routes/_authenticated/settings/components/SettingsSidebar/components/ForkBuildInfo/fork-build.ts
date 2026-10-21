export type ForkBuildStatus = "release" | "merged" | "wip";

/** Stamped by marius/update.sh at build time. */
export interface ForkBuild {
	status: ForkBuildStatus;
	branch: string;
	commit: string;
	dirty: boolean;
	/** The release tag the build is exactly at, else empty. */
	release: string;
	/** The newest release the build contains. */
	baseRelease: string;
	/** The newest release that existed when it was built. */
	latestRelease: string;
	upstream: string;
	builtAt: string;
}

const STATUSES: ForkBuildStatus[] = ["release", "merged", "wip"];

/** Null for an app built without the stamp, or with the older plain string. */
export function parseForkBuild(raw: string | undefined): ForkBuild | null {
	if (!raw?.startsWith("{")) return null;
	try {
		const build = JSON.parse(raw) as ForkBuild;
		return STATUSES.includes(build.status) ? build : null;
	} catch {
		return null;
	}
}

import { getToolEnvironment } from "../terminal/clean-shell-env";
import { getHostWorkerPool } from "../workers/host-worker-pool";
import { readGithubCiTask } from "../workers/tasks/track";
import { TrackedTaskCiWatcher } from "./ci-watcher";
import { TrackedTaskStore } from "./store";

let shared: TrackedTaskStore | null = null;
let watcher: TrackedTaskCiWatcher | null = null;

/** The host's one store: the router and the CI watcher share it. */
export function getTrackedTaskStore(): TrackedTaskStore {
	shared ??= new TrackedTaskStore();
	return shared;
}

/** Starts following linked CI runs; `onChange` tells clients. */
export function startTrackedTaskCiWatcher(onChange: () => void): () => void {
	watcher ??= new TrackedTaskCiWatcher({
		store: getTrackedTaskStore(),
		readCi: async (target) =>
			getHostWorkerPool().run(readGithubCiTask, {
				target,
				env: await getToolEnvironment(),
			}),
		onChange,
	});
	return watcher.start();
}

/** Reads followed runs now, so a new link shows its jobs right away. */
export function checkTrackedTaskCiNow(): void {
	void watcher?.tick();
}

export { type GithubCiTarget, parseGithubCiLink } from "./github-ci";
export { findTaskAgent, type SilenceReason, silenceOf } from "./silence";
export {
	DEFAULT_SILENCE_MINUTES,
	type TrackedTask,
	type TrackedTaskCaller,
	type TrackedTaskCi,
	TrackedTaskNotFoundError,
	TrackedTaskPermissionError,
	TrackedTaskStore,
} from "./store";

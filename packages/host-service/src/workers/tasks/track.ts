// track/* worker tasks. Following a task's GitHub Actions run spawns `gh`
// and parses its JSON; both stay off the host-service event loop. The tool
// environment is resolved in-process and crosses as plain data.

import {
	type GithubCiRead,
	type GithubCiTarget,
	ghApiWith,
	readGithubCi,
} from "../../tracked-tasks/github-ci.ts";
import { defineWorkerTask } from "../define-worker-task.ts";

export const readGithubCiTask = defineWorkerTask<
	{ target: GithubCiTarget; env: Record<string, string> },
	GithubCiRead
>({
	type: "track/readGithubCi",
	handler: ({ target, env }) => readGithubCi(target, ghApiWith(env)),
});

export const trackTasks = [readGithubCiTask];

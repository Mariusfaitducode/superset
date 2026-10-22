# Fork roadmap

Kept by the agents working on this fork and read on every Mac. Updated at each step.

## Marius's list (sidebar)

| # | To-do | State | When / how |
|---|---|---|---|
| 1 | Idea list ? | In build/next, to test | Ideas became **notes** (one concept): per workspace, host-stored, `superset notes` for agents, plus a Notes page across workspaces. PR #17 (`feature/notes-view`) includes `feature/workspace-ideas`, which is dropped. |
| 2 | Latest release / merged version | Done, to validate | The build shown comes from the latest upstream tag (`desktop-v1.39.0`, newest on 2026-10-20) plus the merged branch. Next: weekly rebase, see "Routine". |
| 3 | Show release name | Done, to validate | At the bottom of Settings: upstream tag + branch@commit + date, stamped by `marius/update.sh`. |
| 4 | Allow agents to see todos | Built, to validate | To-dos live on the host (`~/.superset/state/conversation-todos.json`), with priority, type, due day and link. Agents use `superset todos` and the `superset:todos` skill; they can check the user's to-dos but only change or delete their own. |
| 5 | Create general agent | After 4 | A coordinator that sees every session and its to-dos and helps prioritize. Look at the `cockpit` skill first. |
| 6 | Rename conv in sidebar | Done, to validate | Double-click the title, Enter to save, Escape to cancel. |

## Backlog

- **Background task card**: a card on the conversation that says what the agent is doing and how far it is, with a progress bar. The agent updates it, the same way as to-dos. First use: following a prototype's disk cleanup instead of polling Grafana by hand. A metric curve can come later.
- **Test build `build/next` (2026-10-22)**: `marius/main` + #9, #10, #11, #12, #13, #14, #15, #16, #17. Fork CI and Fork build green on 176b4f7c15. Waiting for Marius's test; nothing merged.
- **PR view** (#14, `feature/pr-view`): "Mine" tab on the Pull Requests page, waiting on me / on others, CI, reviews, conflicts, link to the PR's conversation or workspace. Fixes "no GitHub remote" when the remote URL holds a token. In build/next, to test.
- **Agents in Resources** (#9, `feature/agent-resources`): live sessions, memory, close the forgotten ones. In build/next, to test.
- **Ctrl+Tab cards** (#10, `feature/workspace-switcher-cards`): workspaces as centered cards. In build/next, to test.
- **Performance** (#11 titles once per host, #12 stats only while working, #13 host pushes to-do and label changes): sidebar about 284 → 16 requests/min (30 workspaces, 40 conversations, read from the code). In build/next, to test.
- **Ergonomics** (#15 label filter empty state, #16 to-dos ready to type). In build/next, to test. Next round: Marius's answers to 3 questions on daily irritants.
- **⌘K to switch between agents**: merged (#5).
- **Workspace labels** (Waiting, In progress, Today, Top priority, custom): built, to validate. Pills on rows, sidebar filter, `superset labels` for agents.
- **Richer workspaces view**: built, to validate. Cards show labels, agent dots and the top open to-do; filter by label; columns by status or by label.
- Later: general agent, MCP, features behind the paid gate.
- Propose upstream what works (issue superset-sh/superset#8634).
- **CLI ahead of the app** (ideas inbox, 2026-10-22): `superset notes` exists in the CLI but the installed host answers "No procedure found on path workspaceNotes.list". The CLI should detect a missing procedure and say "update the app" instead of failing.
- **`superset --help` hides the fork's commands** (2026-10-22): `todos`, `labels` and `notes` work but are not listed, so an agent told to check `superset --help` never finds them. List them under their own group ("Fork: to-dos, labels, notes").
- **Settings build line reads like the base release** (2026-10-22): on `build/next` Marius read "on top of marius-v1.39.0-4" and thought he was still on v4. Lead with "Test build build/next" and list the PRs it contains.
- **PR view v2** (after testing #14): filters, faster, everything readable at a glance, prioritize. Prompt for its agent: `marius/prompts/pr-view-v2.md`. Continues on `feature/pr-view` (PR #14, not merged yet).
- **Agents' ideas inbox**: agents log friction and feature ideas with `superset notes add "Superset idea: …"`, or in `~/.claude/superset-ideas.md` until notes work; the coordinator moves them here. (2026-10-22: "`todos add` says Not logged in while `list` works" is fixed by `fix/local-cli-without-login`.)

## How we work

1. **One feature, one agent.** Each feature gets a dedicated agent in its own worktree (`~/CodeProjects/superset-<feature>`) and branch off `marius/main`. It agrees the design with Marius first, then loops until its PR is done: English everywhere, targeted tests only, Fork CI green on GitHub, no local app builds (memory).
2. **Integration branch.** The coordinator rebuilds `build/next` from `marius/main` plus every finished PR, fixes conflicts and red CI, and GitHub builds it. Marius installs it with `./marius/install-from-ci.sh build/next` and tests everything together.
3. **Merge and release.** Once it works, the coordinator merges every PR (CI green each time), tags `marius-v<upstream>-<n>`, and GitHub attaches the app. Every Mac installs with `./marius/install-from-ci.sh`.

No PR is merged before the integration test, and nothing stops while a PR or the integration is red.

## Routine

- Every week: `git fetch upstream --tags`. If a new `desktop-vX.Y.Z` exists, rebase `marius/main` onto it, rebuild (`marius/update.sh`), reinstall.
- Before coding on a Mac: `git fetch` to see what the other one pushed.
- Releases: merge into `marius/main` only with green CI, then tag `marius-v<upstream>-<n>`.

# Fork roadmap

Kept by the agents working on this fork and read on every Mac. Updated at each step.

## Marius's list (sidebar)

| # | To-do | State | When / how |
|---|---|---|---|
| 1 | Idea list ? | Handed off | Another session builds a Superset Page. The fork's own ideas join it afterwards. |
| 2 | Latest release / merged version | Done, to validate | The build shown comes from the latest upstream tag (`desktop-v1.39.0`, newest on 2026-10-20) plus the merged branch. Next: weekly rebase, see "Routine". |
| 3 | Show release name | Done, to validate | At the bottom of Settings: upstream tag + branch@commit + date, stamped by `marius/update.sh`. |
| 4 | Allow agents to see todos | Built, to validate | To-dos live on the host (`~/.superset/state/conversation-todos.json`), with priority, type, due day and link. Agents use `superset todos` and the `superset:todos` skill; they can check the user's to-dos but only change or delete their own. |
| 5 | Create general agent | After 4 | A coordinator that sees every session and its to-dos and helps prioritize. Look at the `cockpit` skill first. |
| 6 | Rename conv in sidebar | Done, to validate | Double-click the title, Enter to save, Escape to cancel. |

## Backlog

- **Background task card**: a card on the conversation that says what the agent is doing and how far it is, with a progress bar. The agent updates it, the same way as to-dos. First use: following a prototype's disk cleanup instead of polling Grafana by hand. A metric curve can come later.
- **Custom views**: starting with a PR view. The current PR page says "no GitHub remote" on hub: find out why first.
- **Notion-like ⌘K to switch between agents**: ⌘K clears the terminal today and the palette is on ⌘⇧K, so the shortcut needs a decision.
- **Richer workspaces view**: which information to add, to define.
- Later: ergonomics, performance, general agent, MCP, features behind the paid gate.
- Propose upstream what works (issue superset-sh/superset#8634).

## Routine

- Every week: `git fetch upstream --tags`. If a new `desktop-vX.Y.Z` exists, rebase `marius/main` onto it, rebuild (`marius/update.sh`), reinstall.
- Before coding on a Mac: `git fetch` to see what the other one pushed.
- Releases: merge into `marius/main` only with green CI, then tag `marius-v<upstream>-<n>`.

---
name: ideas
description: Read and add to the idea list pinned to your Superset workspace, which the user sees under the workspace in the app's sidebar. Use at the start of a task to see what the user has in mind for this workspace, when you think of something worth doing later that is out of scope now, when you finish an idea the user listed, or when asked "what ideas do we have", "note this idea", "add it to the ideas". Not for work to do now (that is a to-do: `superset todos`).
argument-hint: what to read, add, or mark done
allowed-tools: Bash(superset:*)
---

# Workspace ideas

Each workspace in Superset has an idea list, shown under its row in the
sidebar. The user pastes ideas there; you read and add to them with
`superset ideas`. From your terminal, every command acts on your own
workspace (`$SUPERSET_WORKSPACE_ID`).

An idea is a short line, with an optional note, and a status: `open` (not
decided yet), `kept` (worth doing), `dropped`, `done`.

## Rules

- **The user's ideas are theirs.** Read them all; mark one `done` when you
  really did it. Never reword, keep, drop or delete them: the host refuses
  it. If one looks outdated or duplicated, add your own idea saying so.
- **Your own ideas** are for what is worth doing later and out of scope now.
  Keep them short, one idea per line, and put the why in `--note`. You may
  change, triage and delete them.
- An idea is not a to-do. What the user must do or decide now goes in
  `superset todos`.

## Commands

```bash
superset ideas list                  # this workspace's ideas
superset ideas list --open           # only open and kept
superset ideas list --all            # every workspace on this machine
superset ideas add "Cache the PR list" --note "The page refetches it on every focus"
superset ideas status <id> done      # the short id from `list` works
superset ideas edit <id> --note ""   # your own only; an empty value clears the note
superset ideas rm <id>               # your own only
```

Output is JSON under agents; each idea has `createdBy` (`user` or `agent`).

If `superset ideas` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

---
name: notes
description: Read and add to the notes pinned to your Superset workspace (ideas, findings, things to do later), which the user sees under the workspace in the app's sidebar and in the Notes view. Use when starting a task, to see what the user has in mind for this workspace, when you think of something worth doing later that is out of scope now, when you finish something the user noted, or when asked "what notes do we have", "note this idea", "add it to the notes". Not for work to do now (that is a to-do: `superset todos`).
argument-hint: what to read, add, or mark done
allowed-tools: Bash(superset:*)
---

# Workspace notes

Each workspace in Superset has a list of notes, shown under its row in the
sidebar and, for every workspace at once, in the app's Notes view. The user
pastes ideas and reminders there; you read and add to them with
`superset notes`. From your terminal, every command acts on your own
workspace (`$SUPERSET_WORKSPACE_ID`).

A note is a short line, with optional details, and a status: `open` (not
decided yet), `kept` (worth doing), `dropped`, `done`.

## Rules

- **The user's notes are theirs.** Read them all; mark one `done` when you
  really did it. Never reword, keep, drop or delete them: the host refuses
  it. If one looks outdated or duplicated, add your own note saying so.
- **Your own notes** are for what is worth doing later and out of scope now.
  Keep them short, one note per line, and put the why in `--details`. You
  may change, triage and delete them.
- A note is not a to-do. What the user must do or decide now goes in
  `superset todos`.
- **Pinned context** (kind `context`, a pin in the app) is a brief, a decision
  or a message the user wants every agent here to read at start. Read it
  first; `superset context` prints it in full. Pin a note yourself
  (`--context`) only when the user asks.

## Commands

```bash
superset notes list                  # this workspace's notes
superset notes list --open           # only open and kept
superset notes list --all            # every workspace on this machine
superset notes add "Cache the PR list" --details "The page refetches it on every focus"
superset notes status <id> done      # the short id from `list` works
superset notes edit <id> --details ""   # your own only; an empty value clears them
superset notes add "Brief: …" --details "…" --context   # pinned for every agent here
superset notes edit <id> --kind note   # unpin (your own only)
superset notes rm <id>               # your own only
```

Output is JSON under agents; each note has `createdBy` (`user` or
`agent`) and `kind` (`note` or `context`).

If `superset notes` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

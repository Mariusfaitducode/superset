---
name: todos
description: Read and update the to-do list of your Superset conversation, which the user sees in the app's sidebar, and see the other conversations' to-dos on this machine. Use at the start of a task to check what the user listed for you, when you finish something the user listed, to record follow-ups the user should see, or when asked "what's on my list", "add a to-do", "check that off", "what are the other agents doing". Not for your own step-by-step plan inside a turn (keep using your built-in task list for that).
argument-hint: what to read, add, or check off
allowed-tools: Bash(superset:*)
---

# Conversation to-dos

Each agent conversation in Superset has a to-do list, shown under it in the
sidebar. The user writes to-dos for you there; you read and update them with
`superset todos`. From your terminal, every command acts on your own
conversation (`$SUPERSET_TERMINAL_ID`).

## Rules

- **The user's to-dos are theirs.** You may check them off when done
  (`superset todos done <id>`), never reword or archive them: the host refuses
  it. If one looks wrong, outdated or duplicated, add your own to-do saying so.
- **Your own to-dos** are for what the user should see and act on: a
  follow-up, a decision waiting on them, a message to send. You may change and
  archive them.
- **Nothing is deleted.** `rm` archives: the to-do leaves the list but stays
  findable with `list --archived` and comes back with `restore`.
- Check a to-do only when it is really done, not when you start it.

## Commands

```bash
superset todos list                 # this conversation's to-dos
superset todos list --open          # without the checked ones
superset todos list --all           # every conversation on this machine
superset todos add "Answer Paul about the release" --kind message --priority high --due 2026-10-24
superset todos done <id>            # the short id from `list` works
superset todos undone <id>
superset todos edit <id> --priority low --link https://github.com/org/repo/pull/12
superset todos rm <id>              # archive it, your own only
superset todos list --archived      # the archived ones
superset todos restore <id>         # back to the list, your own only
```

Fields: `--priority high|normal|low` (default normal), `--kind
code|message|review|other` (default other), `--due YYYY-MM-DD`, `--link <url>`.
Pass an empty value (`--due ""`) to clear one. Output is JSON under agents;
each to-do has `author` (`user` or `agent`) and `doneBy`.

If `superset todos` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

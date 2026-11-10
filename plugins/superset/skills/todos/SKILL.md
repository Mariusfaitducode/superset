---
name: todos
description: Read the to-do list of your Superset conversation, which is the user's own tracker of where each project stands, and see the other conversations' to-dos on this machine. Use at the start of a task to see the state the user recorded, or when the user asks you to check off, change or read a to-do ("what's on my list", "check that off"). Agents never add to-dos: hand work to the user with `superset report`. Not for your own step-by-step plan inside a turn (keep using your built-in task list for that).
argument-hint: what to read, or what the user asked to check off
allowed-tools: Bash(superset:*)
---

# Conversation to-dos

Each agent conversation in Superset has a to-do list, shown under it in the
sidebar. The user writes them there to track each project; you read them with
`superset todos`. From your terminal, every command acts on your own
conversation (`$SUPERSET_TERMINAL_ID`).

## Rules

- **The list is the user's, not yours.** The user keeps it to track where
  each project stands, and only the user writes it. Read it to know that
  state; don't add, reword, check or archive anything unless the user asks
  you to in this conversation. `superset todos add` refuses to run from an
  agent's terminal.
- **Hand work over with `superset report`**, not a to-do: work ready for
  review (`done`), a choice (`decision`), a text to send (`draft`), something
  only the user can do (`blocked`). See the `report` skill.
- **Something worth doing later** that is out of scope now goes in
  `superset notes add`.
- When the user asks you to check one off, do it only if it is really done.
- **Nothing is deleted.** `rm` archives: the to-do leaves the list but stays
  findable with `list --archived` and comes back with `restore`.

## Commands

```bash
superset todos list                 # this conversation's to-dos
superset todos list --open          # without the checked ones
superset todos list --all           # every conversation on this machine
superset todos add "Answer Paul about the release" --kind message --priority high --due 2026-10-24   # user only
superset todos done <id>            # the short id from `list` works
superset todos undone <id>
superset todos edit <id> --priority low --link https://github.com/org/repo/pull/12
superset todos rm <id>              # archive it, your own only
superset todos list --archived      # the archived ones
superset todos restore <id>         # back to the list, your own only
```

The user adds and edits to-dos in the app or with:

Fields: `--priority high|normal|low` (default normal), `--kind
code|message|review|mail|contact|post|meeting|other` (default other), `--due
YYYY-MM-DD`, `--link <url>`, `--recipient <who>`, `--channel <where>` (email,
LinkedIn, phone…), `--draft <text>` (up to 4,000 characters; a heredoc keeps
its line breaks), and `--step <text>` repeated once per step, in order (up to
12; on `edit` it replaces every step). Pass an empty value (`--due ""`,
`--step ""`) to clear one. Output is JSON under agents;
each to-do has `author` (`user` or `agent`) and `doneBy`.

If `superset todos` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

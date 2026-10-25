---
name: track
description: Follow a long wait as a card in the Superset app's task monitor (TopBar button), so the user sees its progress without reading your terminal. Use when waiting longer than about 2 minutes on something, such as a CI run, a build, a deploy, a migration, a long test suite, a disk cleanup or a slow command, and when the user asks to "track", "follow" or "monitor" something. For GitHub Actions the host follows the run itself, so you don't loop on it.
argument-hint: what you are waiting on
allowed-tools: Bash(superset:*)
---

# Tracked tasks

`superset track` turns a long wait into a live card in the app's task monitor
(the button at the top right). The user sees the steps, the progress, the last
note, how long it has run, and a "silent" badge when the card stops moving.
Failures send them a notification. Cards stay until the user closes them.

## When

- Any wait over about 2 minutes: CI, build, deploy, long tests, a slow
  command, an operation watched in a dashboard.
- Not for your own short plan inside a turn, and not to hand work over or ask
  a question (that's `superset report` or a to-do).

## How

```bash
superset track start "Disk cleanup SN004" --steps "Snapshot,Purge logs,Purge images,Check" [--link <url>]
superset track step 2 --note "12 GB freed"   # or the step's name; steps count from 1
superset track progress 40 --note "4/10 hosts"
superset track note "Waiting for the lock"
superset track done --note "38 GB freed"
superset track fail "Purge images: permission denied"
superset tracks list                         # this conversation's; --all, --archived
```

Commands act on your conversation's latest running task; pass `--task <id>`
when you run several at once. Only your conversation can move a task, and only
the user archives it.

## CI: let the host follow it

Give the run or the PR as the link and stop there: the host reads it with `gh`
every 45 s, shows jobs done over the total and the job running, and ends the
task done or failed on its own. Don't poll the CI yourself.

```bash
superset track start "Fork CI on #25" --link https://github.com/OWNER/REPO/actions/runs/123
superset track start "CI of my PR" --link https://github.com/OWNER/REPO/pull/25 --workflow "Fork CI"
superset track link <url>                    # once the run exists
```

With a PR link, all the workflows of its head commit count unless you name one
with `--workflow`. On Marius's fork only "Fork CI" matters: always pass
`--workflow "Fork CI"`.

## Silence

A card reads as silent when it got no news for 15 minutes (change it with
`--silent-after <minutes>`), when your agent session is gone, or when you sit
idle or blocked on a permission for over 2 minutes while it runs. So send a
`step`, `progress` or `note` when something moves, and end the task with
`done` or `fail` before you stop. A task whose CI the host follows is never
silent unless GitHub stops answering.

If `superset track` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

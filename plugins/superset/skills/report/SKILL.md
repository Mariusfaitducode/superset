---
name: report
description: Hand work over to the user through their Superset Desk instead of a message in the chat. Use when you stop and need the user: work ready for review (a PR, a fix, a page), a choice only they can make, a text to send in their name (Slack, GitHub, Notion, email), or a blocker that needs their access or action. Also when asked to "report", "hand over", "put it on my Desk". Not for questions you can answer from the code, the git history or memory.
argument-hint: the kind of hand-over (done, decision, draft, blocked)
allowed-tools: Bash(superset:*)
---

# Reports to the Desk

The user follows many agents at once. Instead of reading every terminal, they
clear one queue, the **Desk**, a few times a day. A report puts your hand-over
there; their answer comes back into your terminal as a normal message.

## Rules

- **One report per hand-over**, at the moment you stop. Then end your turn:
  don't also ask the same thing in the chat.
- **Never ask in the chat what can be a report.** A choice is a `decision`
  report, a text to send is a `draft` report, a missing access is `blocked`.
- **A new report replaces your previous open one of the same kind**, so update
  a question by reporting again, never by asking twice.
- **The summary is one line the user can act on**: "PR #42 ready: Desk view,
  CI green", not "Done!". Put the rest in `--details`, `--checks`, `--test`.
- A `draft` holds the **exact** text to send. Nothing leaves the machine
  before the user approves it on the Desk.
- If the user answers in the chat instead, withdraw the report:
  `superset reports withdraw <id>`.
- `progress` is informative and never lands on the Desk: use it rarely, for a
  long job the user may want to check on.

## Commands

```bash
# Work ready for review
superset report done "PR #42 ready: Desk view, CI green" \
  --link https://github.com/org/repo/pull/42 \
  --checks "bun test src/desk: 12 pass; biome clean; Fork CI green" \
  --test "Open the Desk, press j/k, answer a decision with 1"

# A choice only the user can make (options are picked with keys 1 to 9)
superset report decision "Cache the PR list in memory or on disk?" \
  --details "Memory is simpler; disk survives restarts" \
  --option "In memory" --option "On disk"

# A text to send in the user's name
superset report draft "Reply to Paul about the release date" \
  --draft-file /tmp/reply.md --target slack

# Needs access or an action only the user can do
superset report blocked "Need the staging AWS profile to run the migration check"

superset reports list --open        # your open reports
superset reports withdraw <id>      # the short id from `list` works
```

Kinds: `done`, `decision`, `draft`, `blocked`, `progress`. `--link` and
`--option` repeat. Output is JSON under agents.

If `superset report` is missing, the desktop app is older than the fork build
that added it: tell the user rather than working around it.

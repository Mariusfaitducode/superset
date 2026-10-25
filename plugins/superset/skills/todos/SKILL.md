---
name: todos
description: Read and update the to-do list of your Superset conversation, which the user sees in the app's sidebar, and see the other conversations' to-dos on this machine. Use at the start of a task to check what the user listed for you, when you finish something the user listed, to record follow-ups the user should see, when your plan includes actions only the user can take (a mail, a call, a post), or when asked "what's on my list", "add a to-do", "check that off", "what are the other agents doing". Not for your own step-by-step plan inside a turn (keep using your built-in task list for that).
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
  (`superset todos done <id>`), never reword or delete them: the host refuses
  it. If one looks wrong, outdated or duplicated, add your own to-do saying so.
- **Your own to-dos** are for what the user should see and act on: a
  follow-up, a decision waiting on them, a message to send. You may change and
  delete them.
- Check a to-do only when it is really done, not when you start it.
- **What the user must do goes on the list, not only in the chat.** When you
  propose a plan with actions only the user can take (send a mail, contact
  someone, publish a post, book a meeting, any marketing step), record each
  one as its own to-do, as well as saying it in your reply. Give it the right
  `--kind` (`mail`, `contact`, `post`, `meeting`, `message`), a `--due` day,
  a `--priority`, the `--recipient` and `--channel`, the ordered `--step`s,
  and a `--draft` the user can send as is: the full mail, message or post in
  the user's language and voice, not a summary of it. Then tell the user the
  to-dos are on their list.
- **Keep every list true, not only yours.** When the user says something is
  done ("I opened the Apple Developer account", "I sent the mail"), run
  `superset todos list --all` and check off every open to-do, in any
  conversation, that this completes. If what they said unblocks another
  conversation's to-dos, say which ones in your reply.

## Commands

```bash
superset todos list                 # this conversation's to-dos
superset todos list --open          # without the checked ones
superset todos list --all           # every conversation on this machine
superset todos add "Answer Paul about the release" --kind message --priority high --due 2026-10-24
superset todos done <id>            # the short id from `list` works
superset todos undone <id>
superset todos edit <id> --priority low --link https://github.com/org/repo/pull/12
superset todos rm <id>              # your own only
superset todos report               # Markdown brief of every open to-do, with steps and drafts
```

A to-do for the user to carry out, with everything they need:

```bash
superset todos add "Invite Paul to the beta" --kind mail --priority high --due 2026-10-28 \
  --recipient "Paul Martin <paul@example.com>" --channel email \
  --step "Check Paul's address in the CRM" --step "Send the mail" --step "Add him to the beta list" \
  --draft "$(cat <<'EOF'
Subject: Your invite to the beta

Hi Paul,

The beta opens on Monday and I would love you to try it first.
Here is your access link: https://example.com/beta

Thanks,
Marius
EOF
)"
```

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

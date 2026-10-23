---
name: grants
description: Read what the user lets the agents of your Superset workspace do without asking (push its own branch, open a draft PR, mark it ready, reply to review bots, post GitHub comments, save Slack drafts), and print the start-of-session context with pinned briefs. Use before anything that leaves the machine (git push, gh pr create/ready/comment, a Slack draft), at session start when no context was injected, or when asked "what am I allowed to do", "can I push", "grant this workspace…".
argument-hint: the action you are about to take, or grants to set for another workspace
allowed-tools: Bash(superset:*)
---

# Grants and pinned context

The user decides, per workspace, what its agents may do without asking.
From your terminal, commands act on your own workspace
(`$SUPERSET_WORKSPACE_ID`).

```bash
superset grants list              # every grant, ✓ on the ones this workspace has
superset grants list --all        # every granted workspace on this machine
superset context                  # the start-of-session block: to-dos, labels, grants, pinned context
```

## Rules

- **Granted: do it, don't ask.** A granted action costs the user nothing; asking
  for it does. Say in your report that you did it.
- **Not granted and it leaves the machine** (push, PR, comment, message): don't
  ask in the chat. Prepare it (branch ready, text drafted) and hand it to the
  user as a draft or a decision, with `superset report` when this build has it,
  otherwise a `superset todos add` for the user.
- Local commits are always fine. Never push to a branch that is not this
  workspace's own, never force-push, never merge, whatever is granted.
- Grants are advisory for now: nothing stops you, so following them is on you.

## Setting grants

The user sets them in the app (right-click the workspace, **Agent
permissions**). A coordinator may set them for another workspace; the host
refuses an agent changing its own.

```bash
superset grants set push-own-branch open-draft-pr --workspace <id>
superset grants unset open-draft-pr --workspace <id>
```

## Pinned context

Notes of kind `context` are briefs, decisions or messages the user pinned for
every agent of the workspace. `superset context` prints them in full; read them
before starting. Pin one yourself only when the user asks you to:

```bash
superset notes add "Brief: …" --details "…" --context
superset notes edit <id> --kind note     # unpin
```

If `superset grants` or `superset context` is missing, the desktop app is older
than the fork build that added them: tell the user rather than working around it.

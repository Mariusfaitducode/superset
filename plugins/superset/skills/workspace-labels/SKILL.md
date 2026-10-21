---
name: workspace-labels
description: Read and set the labels of your Superset workspace (Waiting, In progress, Today, Top priority, or the user's own), which the user filters the sidebar by. Use when you start working on a workspace, when you stop to wait for the user, when you finish, or when asked to "mark this workspace", "label it today", "what's labeled top priority". Not for folders in the sidebar (those are tags).
argument-hint: the labels to read, add or remove
allowed-tools: Bash(superset:*)
---

# Workspace labels

The user labels workspaces to organize their day and filters the sidebar by
label. From your terminal, commands act on your own workspace
(`$SUPERSET_WORKSPACE_ID`).

```bash
superset labels list                    # every label, ✓ on the ones this workspace has
superset labels list --all              # every labeled workspace on this machine
superset labels add Waiting             # names ignore case; quote names with spaces
superset labels remove "In progress"
```

- Only the labels the user made exist; the CLI cannot create one. If none
  fits, say so instead of picking a wrong one.
- Keep them true: put `Waiting` on when you stop for the user's answer and
  take it off when you resume. Leave labels you did not set alone unless the
  user asks.
- Labels are not sidebar folders: `superset workspaces update --tags` moves a
  workspace between folders, `superset labels` does not.

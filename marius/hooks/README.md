# Claude Code hooks for the fork

`superset-context.sh` is the SessionStart hook that gives every agent started
in a Superset workspace its context: open to-dos, labels, grants and pinned
context notes, from `superset context`. On a build without that command it
falls back to the previous summary (to-dos, labels, notes).

Install it on each Mac, once the build with `superset context` is installed:

```bash
cp ~/.claude/hooks/superset-context.sh ~/.claude/hooks/superset-context.sh.bak
cp marius/hooks/superset-context.sh ~/.claude/hooks/superset-context.sh
chmod +x ~/.claude/hooks/superset-context.sh
SUPERSET_WORKSPACE_ID=<a workspace id> ~/.claude/hooks/superset-context.sh | jq -r .hookSpecificOutput.additionalContext
```

The hook is already registered in `~/.claude/settings.json` under
`SessionStart`; only the script changes.

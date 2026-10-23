#!/bin/bash
# SessionStart: give an agent running in a Superset workspace what it should
# know at start (open to-dos, labels, grants, pinned context) from
# `superset context`. Copy to ~/.claude/hooks/superset-context.sh; see
# marius/hooks/README.md.
[ -n "$SUPERSET_WORKSPACE_ID" ] || exit 0
command -v superset >/dev/null || exit 0
export SUPERSET_WORKSPACE_ID
python3 - <<'PY'
import json, subprocess

intro = "Superset (Marius's fork) context for this workspace. Keep it up to date as you work (see ~/.claude/CLAUDE.md, \"Superset: use the fork's features\")."

def run(*args, json_output=True):
    try:
        out = subprocess.run(["superset", *args, *(["--json"] if json_output else [])], capture_output=True, text=True, timeout=4)
        if out.returncode != 0 or not out.stdout.strip():
            return None
        return json.loads(out.stdout) if json_output else out.stdout.strip()
    except Exception:
        return None

block = run("context", json_output=False)
if block:
    lines = [intro, *block.splitlines()[1:]]
else:
    # Builds without `superset context`: the previous hook's summary.
    lines = [intro, "- Grants and pinned context: `superset context` unavailable on this build; ask before anything leaves the machine."]
    todos = run("todos", "list", "--open")
    if todos is None:
        lines.append("- To-dos: `superset todos` unavailable on this build.")
    else:
        lines.append(f"- Open to-dos of this conversation: {len(todos)}" + ("" if todos else " (add yours with `superset todos add`)"))
        for t in todos[:8]:
            lines.append(f"  - [{t.get('author','?')}] {t.get('text','')}")
    labels = run("labels", "list")
    if labels is not None:
        on = [l["name"] for l in labels if l.get("on")]
        lines.append("- Workspace labels on: " + (", ".join(on) if on else "none") + " (set `In progress` while working: `superset labels add \"In progress\"`)")
    notes = run("notes", "list", "--open")
    if notes is None:
        lines.append("- Notes: `superset notes` unavailable on this build; log Superset ideas in ~/.claude/superset-ideas.md.")
    else:
        lines.append(f"- Open notes on this workspace: {len(notes)}")
        for n in notes[:8]:
            lines.append(f"  - {n.get('text','')}")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(lines)}}))
PY

# Brief for an agent working on a fork feature

Read this, then `marius/README.md` and `marius/ROADMAP.md` ("How we work"). You own one feature, in your own worktree and branch, and you drive its PR to the end. The coordinator (another session) builds the integration branch, merges and releases; you never merge.

## Your loop

1. **Design with Marius first.** Ask short, clear questions, one at a time, in French. Play back what you understood before building. Nothing gets built until he agrees on what it is.
2. **Build** in your worktree only. Match the surrounding code: rare comments that say why, `react-icons/lu`, Lingui `t` for every visible string, both sidebar row variants (`DashboardSidebarExpandedWorkspaceRow` and `DashboardSidebarLegacyExpandedWorkspaceRow`) when you touch a row.
3. **Check locally, light only:** `bun test <the folders you touched>`, `bunx biome check <your files>` (CI fails on any warning), `bun run check:i18n`. Fill translations with `python3 marius/i18n/fill.py <file.json>` (`{"msgid": [cs, de, es, fr, id, it, ja, ko, nl, pl, pt-BR, ru, tr, vi, zh-CN, zh-TW]}`). A new localStorage store must be added to `apps/desktop/src/renderer/lib/persisted-keys/persisted-key-registry.test-data.ts`.
4. **Push and open the PR to `marius/main`.** Fork CI (lint + i18n, typecheck, tests) runs on GitHub: that is your typecheck. Loop until it is green. Merge `origin/marius/main` into your branch when it moves; never rebase a pushed branch, never force-push.
5. **Hand over** to the coordinator with the envelope below, then stay available for review feedback.

## Hard rules

- **Memory:** the laptop has 16 GB shared by many agents. Never build the app, run the dev server, the full test suite or a full typecheck locally. Check `memory_pressure` before anything heavy. Stop what you started before handing back.
- **Git:** commits as `Mariusfaitducode <105292058+Mariusfaitducode@users.noreply.github.com>` (already the repo config), conventional format, ending with `Co-Authored-By: Claude …`. Pushing your own feature branch and opening its PR are part of your job; nothing else gets pushed.
- **English** in code, comments, commits, PR titles and descriptions. French with Marius.
- **Texts in Marius's name** (PR description, comments): load the `my-voice` skill, show him the exact text, wait for his OK.
- **Be honest:** say what you verified and what you did not. Marius validates the UI himself.
- **Use the fork's tools:** keep your to-dos with `superset todos`, and your workspace label with `superset labels` (`In progress` while working, `Waiting` when you need Marius).

## Envelope

End your hand-over with one of:

```text
SUPERSET_WORKER_DONE
task: <feature>
summary: <one line>
pr: <url>
checks: <what ran, with results>
handoff: <what Marius should test, or none>
```

```text
SUPERSET_WORKER_BLOCKED
task: <feature>
reason: <specific blocker>
needs: <decision or access required>
```

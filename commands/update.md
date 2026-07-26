---
description: Vendor the shared rule set into this repository and refresh the lock
---

# Update vendored rules

Run the plugin's vendoring CLI against the current repository:

```bash
claude-rules sync
```

If the repository uses GitHub Actions and has no `.github/workflows/rules-check.yml` yet, run `claude-rules sync --with-ci` instead so the drift check is wired into CI.

Then report to the user:

- how many files were vendored, and at which plugin version
- any files removed because they were retired upstream
- the paths they need to commit: `.claude/rules/`, `.claude/rules-lock.json`, `.claude/rules-check.mjs`, and the workflow if one was written

Do not hand-edit anything under `.claude/rules/` afterwards. Those files are vendored copies — an edit there is invisible to every other repository and will be overwritten by the next sync. If a rule needs changing, say so plainly and point at the upstream `claude-rules` repository instead.

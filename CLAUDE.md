# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`claude-rules`) that distributes shared coding standards and workflow rules. On `SessionStart`, the hook in `hooks/hooks.json` runs `scripts/sync-rules.sh`, which symlinks all `rules/**/*.md` and `rules/**/*.enforce.toml` files into the consuming project's `.claude/rules/` directory.

The rule bodies here are kept in sync with `mimir`'s `.claude/rules/` — that repo is the source of truth for shared rule prose. When a rule changes there, mirror it here rather than editing in place and letting the two drift.

## Architecture

```
.claude-plugin/plugin.json   — Plugin manifest (name, version, metadata)
hooks/hooks.json              — SessionStart hook definition
scripts/sync-rules.sh         — Idempotent symlink script (runs each session)
rules/                        — Rule files organized by category:
  coding/                     — Language conventions (functional style, error handling, etc.)
  tooling/                    — Tool preferences (Bun, warp-grep, Morph fast-apply)
  quality/                    — Quality gates (TDD, security review, test coverage)
  safety/                     — Security constraints
  workflow/                   — Task startup order, plan-first process, stop conditions
  communication/              — Output formatting standards
```

## How the Sync Works

On `SessionStart`, the hook tries `bash sync-rules.sh` first and falls back to `powershell.exe sync-rules.ps1` on Windows. Both scripts find all `*.md` and `*.enforce.toml` files under the plugin's `rules/` directory, mirror the directory structure into the target project's `.claude/rules/`, and create symlinks. The PowerShell script falls back to copying files when symlinks aren't available (Windows without Developer Mode). Both use `$CLAUDE_PLUGIN_ROOT` to locate themselves. Project-specific rules in the target are never overwritten.

The generated `AGENTS.md` concatenates `*.md` only — `.enforce.toml` files are machine-read detector configs, not agent-facing prose.

## Developing Rules

- Each rule is a standalone Markdown file in `rules/<category>/`.
- Rules should be terse — a heading and a few bullets or sentences. They're injected into Claude's context, so brevity matters.
- New categories are just new subdirectories under `rules/`.
- The sync script auto-discovers files by glob; no manifest of individual rules is needed.

## Developing Rules — Paired Enforcement

A rule may ship a sibling `<name>.enforce.toml` that turns it into a deterministic detector, read by Mimir's rules engine (`packages/plugin-core/src/rules/loader.ts` in the mimir repo), which globs `.claude/**/*.enforce.toml`.

```toml
id = "coding/example"
body = "./example.md"          # relative to this toml's own directory
enabled = true
event = "file"                  # file | bash | stop | prompt | all
exclude_globs = ["*.test.*"]
message = "Short violation message; ${line} and ${match} interpolate."

[[conditions]]
field = "new_text"              # new_text | file_path | command
operator = "regex_match"        # regex_match | contains | equals
pattern = '''…'''
```

Because `body` resolves against the toml's directory, the pair must always sync together into the same folder. Conditions are ANDed; `[[negative_conditions]]` suppress a match. `detector = "builtin:<name>"` swaps the regex for a builtin (e.g. `builtin:file-length`).

Precision matters more than coverage — a detector that fires on legitimate code trains the reader to ignore it.

## Developing Rules — Scoping

Rules can include YAML frontmatter with `paths` to limit when they load:

```markdown
---
paths: ["*.ts", "*.tsx", "*.js", "*.jsx"]
---
# Rule Title
```

The key is `paths`, **not** `globs`. This was verified empirically against Claude Code 2.1.220: a rule scoped with `globs: ["*.zzz"]` loaded unconditionally, while `paths: ["*.zzz"]` was correctly withheld. `globs` is not a key Claude Code recognises — a rule carrying it loads into every session regardless of what is being edited, silently costing context. Claude Code also strips frontmatter before injecting the body, so a wrong key leaves no visible trace.

A bare `*.ext` pattern matches nested files — `paths: ["*.ts"]` loads for `src/foo.ts`, so there is no need to write `**/*.ts`.

Only use `paths` for rules that are language- or file-type-specific. Workflow, safety, and communication rules should load unconditionally.

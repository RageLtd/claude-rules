# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`claude-rules`) that distributes shared coding standards and workflow rules. On `SessionStart`, the hook in `hooks/hooks.json` runs `scripts/sync-rules.sh`, which symlinks all `rules/**/*.md` files into the consuming project's `.claude/rules/` directory.

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

`sync-rules.sh` finds all `*.md` files under the plugin's `rules/` directory, mirrors the directory structure into the target project's `.claude/rules/`, and creates symlinks (`ln -sf`). It uses `$CLAUDE_PLUGIN_ROOT` to locate itself. Project-specific rules in the target are never overwritten.

## Developing Rules

- Each rule is a standalone Markdown file in `rules/<category>/`.
- Rules should be terse — a heading and a few bullets or sentences. They're injected into Claude's context, so brevity matters.
- New categories are just new subdirectories under `rules/`.
- The sync script auto-discovers files by glob; no manifest of individual rules is needed.

## Key Conventions Enforced by This Plugin

- **Functional style**: No classes in TS/JS; prefer pure functions and immutable data across all languages.
- **Error handling**: `{ data, error }` result objects in TS/JS (no try/catch); `Result<T, E>` in Rust; `(val, error)` in Go.
- **Plan-first workflow**: Present plan, get approval, then execute. Re-plan when scope changes.
- **Task startup order**: Memory (goldfish) → Docs (Context7) → Code (WarpGrep/grep).
- **Bun over Node** for TS/JS projects.

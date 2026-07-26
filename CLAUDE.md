# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**This repository is the canonical rule set.** `rules/` is the source of truth — not a mirror of anything. Rule prose is authored here and vendored outward; if `mimir`'s `.claude/rules/` and this repo ever disagree, this repo wins and mimir gets re-synced.

Around that content sits a Claude Code plugin whose only job is vendoring: `bin/claude-rules` copies the rules into a consuming repo as real committed files, records a digest of each in a lock, and emits a dependency-free checker that fails CI when a copy diverges.

There is no `SessionStart` hook and nothing is symlinked. Propagation is explicit — a repo receives rule changes when someone runs `/claude-rules:update` in it, not silently at session start.

## Architecture

```
.claude-plugin/plugin.json   — Plugin manifest (name, version, metadata)
bin/claude-rules             — The vendoring CLI (on PATH while the plugin is enabled)
commands/update.md           — /claude-rules:update, a thin wrapper over `sync`
src/
  constants.ts               — Paths written into a consuming repo
  attempt.ts                 — The ONLY place allowed to catch; converts throws to results
  lock.ts                    — Digests, lock schema, validation
  sync.ts                    — Vendor + prune
  check.ts                   — Verify (mirrors the emitted checker)
  templates.ts               — Source of the emitted checker and CI workflow
rules/                       — The canonical rule set, by category
```

## What Sync Writes

Into the consuming repo, all committed:

- `.claude/rules/**` — real files, both `*.md` and `*.enforce.toml`
- `.claude/rules-lock.json` — `{ lockVersion, source, version, files: { path: "sha256-…" } }`
- `.claude/rules-check.mjs` — plain Node, no deps, no network
- `.github/workflows/rules-check.yml` — only with `--with-ci`

Two invariants worth preserving if you touch `sync.ts`:

1. **Pruning is lock-driven, never directory-driven.** Only files the previous lock says we wrote, and which no longer exist upstream, get removed. This is what lets a repo keep its own rules in `.claude/rules/` alongside the vendored set.
2. **The lock carries no timestamp.** A generated-at field would make every sync produce a diff whether or not anything changed, which defeats the point.

Digests normalise CRLF to LF before hashing. Without that, a Windows checkout with `core.autocrlf=true` breaks every digest without anyone editing anything — there's a CI job pinning this.

## Developing Rules

- Each rule is a standalone Markdown file in `rules/<category>/`.
- Rules should be terse — a heading and a few bullets or sentences. They're injected into Claude's context, so brevity matters.
- New categories are just new subdirectories under `rules/`.
- `sync` auto-discovers files by glob; no manifest of individual rules is needed.
- Run `bun test` after touching anything under `src/`. The suite covers the four behaviours that matter: clean vendor, tamper detection, upstream-deletion pruning, and repo-local rules surviving both commands.

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

Only use `paths` for rules that are language- or file-type-specific. Workflow and safety rules should load unconditionally.

## What Does Not Belong Here

Two categories are deliberately excluded, and re-adding either will reintroduce a conflict:

- **Response style** (how the agent phrases things, whether it uses bullets or prose). That belongs to the persona or system prompt driving the session. A vendored rule that disagrees with the persona means the agent picks one arbitrarily, differently each session — which is how `communication/style.md` was removed in v1.0.2, after it landed in the mimir repo instructing bullet-point summaries at a prose-only persona.
- **Personal tooling preferences** (which plugins to enable, editor setup). Those are per-developer, not per-project, and vendoring them imposes one person's setup on every collaborator. `~/.claude/rules/` is the right home — it applies across all your projects and ships to nobody.

The test is whether the rule describes *how code in this repository should be written*. If it describes how a person or an agent should behave in general, it belongs somewhere else.

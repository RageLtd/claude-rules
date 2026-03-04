# claude-rules

A [Claude Code](https://claude.ai/code) plugin that distributes shared coding standards and workflow rules. Install it once, and every Claude Code session automatically gets your team's conventions injected as rules.

## Prerequisites

This plugin bundles the [Morph](https://morphllm.com) MCP server for fast file editing. Install it globally:

```bash
bun add -g @morphllm/morphmcp
# or with npm
npm install -g @morphllm/morphmcp
```

## Install

```
claude plugin add claude-rules@rageltd
```

## How it works

On every session start, a hook syncs all rule files from this plugin into your project's `.claude/rules/` directory. On macOS/Linux the hook uses bash with symlinks; on Windows it falls back to PowerShell, using symlinks if Developer Mode is enabled or copying files otherwise. Rules are organized by category:

| Category | Rules |
|----------|-------|
| **coding** | Functional style, error handling, dependency management, constants over strings, testing, process reuse |
| **tooling** | Bun over Node, Warp Grep, Morph fast-apply, recommended plugins |
| **quality** | Quality standards and gates |
| **safety** | Security constraints |
| **workflow** | Plan-first process, task startup order |
| **communication** | Output formatting and style |

Rules are re-synced each session (idempotent). Your project's own rules in `.claude/rules/` are never overwritten.

### Platform support

| Platform | Shell | Link method |
|----------|-------|-------------|
| macOS / Linux | bash | symlinks |
| Windows (Developer Mode) | PowerShell | symlinks |
| Windows (no Developer Mode) | PowerShell | file copy |

## Key conventions

- **Functional style** — No classes in TS/JS; prefer pure functions and immutable data
- **Error handling** — `{ data, error }` result objects in TS/JS, `Result<T, E>` in Rust, `(val, error)` in Go
- **Plan-first workflow** — Present plan, get approval, then execute
- **Bun over Node** for TS/JS projects
- **Dependencies via package manager** — Always use `bun add`, `npm install`, etc.; never manually edit manifests

## Adding rules

Each rule is a standalone Markdown file in `rules/<category>/`. New categories are just new subdirectories — the sync script auto-discovers everything by glob.

Rules should be terse. They're injected into Claude's context window, so brevity matters.

## Development

```bash
bun install              # install dev deps
bun run release:dry      # preview version bump
bun run release          # bump version, commit, tag
```

Versioning is automatic via conventional commits:
- `feat:` → minor bump
- `fix:`, `refactor:`, `perf:`, etc. → patch bump
- `feat!:` or `BREAKING CHANGE` → major bump
- `docs:`, `chore:` → no release

## License

[Unlicense](LICENSE) — public domain.

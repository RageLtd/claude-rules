# claude-rules

One source of truth for coding standards and workflow rules, vendored into as many repositories as you like — without those copies ever drifting apart.

This repository *is* the canonical rule set. A Claude Code plugin wraps it with a vendoring CLI: you run `/claude-rules:update` in a repo, it writes the rules in as real committed files plus a lock, and a dependency-free checker fails CI the moment a copy diverges from that lock.

Collaborators install nothing. They clone the repo and the rules are already there.

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

Two audiences, two mechanisms.

**You**, maintaining repos, have the plugin installed. In any repo, run:

```
/claude-rules:update
```

That vendors the full rule set into `.claude/rules/` as real files, writes `.claude/rules-lock.json` recording a SHA-256 of each one, and emits `.claude/rules-check.mjs`. Commit all three. Add `--with-ci` on first run to also write a GitHub Actions workflow.

**Everyone else** installs nothing. The rules arrive with `git clone`, and CI runs the committed checker:

```bash
node .claude/rules-check.mjs
```

It reads the lock, re-hashes each vendored file, and exits non-zero on any edit or deletion — telling the reader to change the rule upstream rather than in place. No network, no dependencies, plain Node so it runs on any runner.

Copies exist, but they cannot drift, because divergence is a build failure rather than a matter of discipline.

### What the tool will not touch

`check` verifies only the paths named in the lock, and `sync` prunes only files it previously wrote that have since been retired upstream. So a repository can keep its own project-specific rules in `.claude/rules/` alongside the vendored set — they survive every sync and never trip the check. Vendored content is governed; your own content stays yours.

Rules are organized by category:

| Category | Rules |
|----------|-------|
| **coding** | Functional style, error handling, dependency management, constants over strings, exhaustive switch, no explicit return types, control braces (C family), testing, process reuse |
| **tooling** | Bun over Node, Bun built-ins over packages, Warp Grep, Morph fast-apply |
| **quality** | File length, quality standards and gates |
| **safety** | Security constraints, no pipe swallowing |
| **workflow** | Plan-first process, task startup order, codebase map, read before writing |

These rules describe *how code should be written*. Deliberately absent: how the agent should talk, and which plugins you like. Response style belongs to whatever persona or system prompt is driving the session, and a rule that disagrees with it just makes the agent pick one arbitrarily. Personal tooling preferences belong in `~/.claude/rules/`, which applies across every project without being imposed on collaborators.

Rules carry `paths:` frontmatter where they're language-specific, so Claude Code loads them lazily — only once a matching file enters the session. The key is `paths`, not `globs`; `globs` is silently ignored and the rule then loads in every session regardless of file type.

### Paired enforcement

Most rules ship as a `.md` file alone — prose the agent reads. Some also ship a sibling `.enforce.toml`, which turns the same rule into a deterministic detector: a regex or builtin that fires on an Edit, Write, or Bash call and surfaces the rule body at the moment of the violation, rather than hoping it stayed in context.

The two files are one rule and must stay side by side — the toml's `body` field is a relative path to its markdown. `sync` vendors and locks both.

`.enforce.toml` files are read by [Mimir](https://github.com/RageLtd/mimir)'s rules engine, which globs `.claude/**/*.enforce.toml`. Under plain Claude Code they are inert and harmless.

### CLI

The plugin puts `claude-rules` on the Bash tool's `PATH` while enabled, so you can drive it directly instead of through the slash command:

```bash
claude-rules sync [--with-ci]   # vendor rules in, write the lock and checker
claude-rules check              # verify, same verdict CI will reach
claude-rules sync --cwd ../other-repo
```

`sync` is idempotent and the lock carries no timestamp, so re-running it on unchanged rules produces no diff. Running `sync` over locally-edited vendored files restores them to the locked content.

## Key conventions

- **Functional style** — No classes in TS/JS; prefer pure functions and immutable data
- **Error handling** — `{ data, error }` result objects in TS/JS, `Result<T, E>` in Rust, `(val, error)` in Go
- **Plan-first workflow** — Present plan, get approval, then execute
- **Bun over Node** for TS/JS projects
- **Dependencies via package manager** — Always use `bun add`, `npm install`, etc.; never manually edit manifests

## Adding rules

Each rule is a standalone Markdown file in `rules/<category>/`. New categories are just new subdirectories — `sync` discovers everything by glob, so there's no manifest to update.

Rules should be terse. They're injected into Claude's context window, so brevity matters.

Changing a rule here does not reach your other repositories until you release and re-run `/claude-rules:update` in each. That's deliberate: propagation is something you review, not something that happens behind you at session start.

To add deterministic enforcement, drop a `<rule-name>.enforce.toml` next to the markdown with `body = "./<rule-name>.md"` and one or more `[[conditions]]`. Keep the detector precise — a noisy rule gets ignored, which is worse than no rule.

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

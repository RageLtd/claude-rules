# Dependency Management (CRITICAL)

Always use the language's package manager to add, remove, or update dependencies. Never manually edit manifest files (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc.).

- **TypeScript/JavaScript**: `bun add` / `npm install` / `pnpm add`
- **Rust**: `cargo add` / `cargo remove`
- **Go**: `go get` / `go mod tidy`
- **Python**: `uv add` / `pip install` / `poetry add`

## Workspace Dependencies

In monorepos/workspaces, if a package is used by more than one workspace member, elevate it to a workspace-level dependency. Individual members should reference the workspace dependency rather than declaring their own version.

- **Bun/npm/pnpm**: Define in root `package.json` workspaces config; use `"workspace:*"` protocol
- **Rust (Cargo)**: Add to `[workspace.dependencies]` in root `Cargo.toml`; reference with `dep.workspace = true`
- **Python (uv)**: Define in root `pyproject.toml` under `[tool.uv.workspace]`

## Adding New Dependencies

Prefer stdlib and existing dependencies before adding new packages. Justify any new dependency with a clear reason (complexity it removes, maintenance burden it avoids). One-function packages are almost never worth it.

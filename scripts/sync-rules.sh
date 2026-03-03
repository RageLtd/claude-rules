#!/usr/bin/env bash
# Symlinks plugin rules into the project's .claude/rules/ directory.
# Runs on SessionStart. Idempotent — recreates symlinks each session.
# Project-specific rules (not shipped by this plugin) are never touched.

set -euo pipefail

PLUGIN_RULES="${CLAUDE_PLUGIN_ROOT}/rules"
TARGET_RULES=".claude/rules"

if [[ ! -d "$PLUGIN_RULES" ]]; then
  echo "claude-rules: no rules directory found in plugin" >&2
  exit 1
fi

# Remove dangling symlinks that point back into this plugin (stale rules)
if [[ -d "$TARGET_RULES" ]]; then
  find "$TARGET_RULES" -type l | while read -r link; do
    target="$(readlink "$link")"
    if [[ "$target" == "$PLUGIN_RULES"/* && ! -e "$link" ]]; then
      rm "$link"
    fi
  done
fi

# Walk plugin rules and symlink each file, preserving directory structure
find "$PLUGIN_RULES" -type f -name '*.md' | while read -r src; do
  rel="${src#"$PLUGIN_RULES"/}"
  dest="${TARGET_RULES}/${rel}"
  dest_dir="$(dirname "$dest")"

  mkdir -p "$dest_dir"
  ln -sf "$src" "$dest"
done

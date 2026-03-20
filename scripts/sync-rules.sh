#!/usr/bin/env bash
# Symlinks plugin rules into the project's .claude/rules/ directory and
# generates AGENTS.md (for Forge compatibility) with merged project docs + rules.
#
# Runs on SessionStart. Idempotent — recreates symlinks and regenerates
# AGENTS.md each session. Project-specific rules (not shipped by this plugin)
# are never touched.

set -euo pipefail

PLUGIN_RULES="${CLAUDE_PLUGIN_ROOT}/rules"
TARGET_RULES=".claude/rules"
MARKER="<!-- claude-rules:merged -->"

if [[ ! -d "$PLUGIN_RULES" ]]; then
  echo "claude-rules: no rules directory found in plugin" >&2
  exit 1
fi

# ── Symlink rules into .claude/rules/ ──────────────────────────────────────

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

# ── Generate AGENTS.md for Forge ───────────────────────────────────────────

# Read the project docs from CLAUDE.md (or AGENTS.md if CLAUDE.md is a symlink
# to it). If the file already contains our merge marker, extract only the
# content above it — that's the original project docs.
read_project_docs() {
  local source=""

  # Prefer CLAUDE.md (even if it's a symlink — we follow it)
  if [[ -f "CLAUDE.md" ]]; then
    source="CLAUDE.md"
  elif [[ -f "AGENTS.md" ]]; then
    source="AGENTS.md"
  else
    return
  fi

  local content
  content="$(cat "$source")"

  # If file contains our marker, take only content above it
  if [[ "$content" == *"$MARKER"* ]]; then
    echo "$content" | sed "/${MARKER}/,\$d" | sed -e :a -e '/^[[:space:]]*$/{ $d; N; ba; }'
  else
    echo "$content"
  fi
}

# Collect all rule files into a single string
collect_rules() {
  find "$PLUGIN_RULES" -type f -name '*.md' | sort | while read -r src; do
    rel="${src#"$PLUGIN_RULES"/}"
    category="$(dirname "$rel")"
    name="$(basename "$rel" .md)"
    echo "## ${category}/${name}"
    echo ""
    cat "$src"
    echo ""
  done
}

project_docs="$(read_project_docs)"
rules="$(collect_rules)"

# Write AGENTS.md = project docs + marker + rules
{
  if [[ -n "$project_docs" ]]; then
    echo "$project_docs"
    echo ""
  fi
  echo "$MARKER"
  echo ""
  echo "# Rules"
  echo ""
  echo "$rules"
} > AGENTS.md

# If CLAUDE.md is a symlink (typically to AGENTS.md), replace it with a plain
# file containing only the project docs so Claude Code reads the clean version
# (it gets rules via .claude/rules/ symlinks instead).
if [[ -L "CLAUDE.md" ]]; then
  rm "CLAUDE.md"
  if [[ -n "$project_docs" ]]; then
    echo "$project_docs" > CLAUDE.md
  fi
elif [[ ! -f "CLAUDE.md" && -n "$project_docs" ]]; then
  # No CLAUDE.md at all — create one from project docs
  echo "$project_docs" > CLAUDE.md
fi

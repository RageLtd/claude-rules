/**
 * Shared paths and identifiers for the vendoring tool.
 *
 * Everything the tool writes into a consuming repository lives under
 * `.claude/`, and every path recorded in the lock is relative to the
 * repository root so the file is readable on its own.
 */

/** Directory inside the plugin holding the canonical rule set. */
export const SOURCE_RULES_DIR = "rules";

/** Directory inside a consuming repo that receives the vendored copies. */
export const TARGET_RULES_DIR = ".claude/rules";

/** Lock file recording what was vendored, and at which hashes. */
export const LOCK_PATH = ".claude/rules-lock.json";

/** Dependency-free verifier emitted alongside the lock. */
export const CHECKER_PATH = ".claude/rules-check.mjs";

/** Optional CI workflow, written only when `--with-ci` is passed. */
export const WORKFLOW_PATH = ".github/workflows/rules-check.yml";

/** File suffixes that make up a rule. Anything else in `rules/` is ignored. */
export const RULE_SUFFIXES = [".md", ".enforce.toml"] as const;

/** Prefix on every digest in the lock, so the algorithm is self-describing. */
export const DIGEST_PREFIX = "sha256-";

/** Lock schema version — bump only on a breaking change to the format. */
export const LOCK_VERSION = 1;

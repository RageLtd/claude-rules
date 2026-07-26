import * as path from "node:path";
import { attempt } from "./attempt";
import { LOCK_PATH } from "./constants";
import { digest, readLock } from "./lock";

/**
 * Verify vendored rules against the lock.
 *
 * Mirrors the emitted `.claude/rules-check.mjs` so the same answer comes back
 * whether you run it locally through the plugin or in CI through the
 * committed checker. Only paths named in the lock are examined — extra files
 * under `.claude/rules/` belong to the repository and are none of our
 * business.
 */
export const check = async (projectRoot: string) => {
  const lock = await readLock(projectRoot);
  if (lock.error !== null) {
    return { data: null, error: lock.error };
  }
  if (lock.data === null) {
    return {
      data: null,
      error: `${LOCK_PATH} not found — this repo has not been synced yet`,
    };
  }

  const missing: string[] = [];
  const modified: string[] = [];

  for (const [relativePath, expected] of Object.entries(lock.data.files)) {
    const contents = await attempt(() =>
      Bun.file(path.join(projectRoot, relativePath)).text(),
    );
    if (contents.data === null) {
      missing.push(relativePath);
      continue;
    }
    if (digest(contents.data) !== expected) {
      modified.push(relativePath);
    }
  }

  return {
    data: {
      source: lock.data.source,
      version: lock.data.version,
      total: Object.keys(lock.data.files).length,
      missing: missing.sort(),
      modified: modified.sort(),
      clean: missing.length === 0 && modified.length === 0,
    },
    error: null,
  };
};

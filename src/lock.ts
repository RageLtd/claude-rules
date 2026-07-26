import { createHash } from "node:crypto";
import * as path from "node:path";
import { attempt, attemptSync } from "./attempt";
import { DIGEST_PREFIX, LOCK_PATH, LOCK_VERSION } from "./constants";

/**
 * Digest of a rule file.
 *
 * Line endings are normalised to LF first. Without this, a Windows checkout
 * with `core.autocrlf=true` rewrites every `.md` on the way to disk and the
 * digests stop matching even though nobody edited anything. Normalising means
 * the lock describes content, not whichever line ending the filesystem chose.
 */
export const digest = (contents: string) => {
  const normalised = contents.replace(/\r\n/g, "\n");
  return DIGEST_PREFIX + createHash("sha256").update(normalised).digest("hex");
};

/**
 * One vendored rule set: which plugin produced it, at what version, and the
 * digest of every file written. Paths are relative to the repository root.
 */
export type Lock = {
  lockVersion: number;
  source: string;
  version: string;
  files: Record<string, string>;
};

/**
 * Deliberately no timestamp. A generated-at field would make every sync
 * produce a diff whether or not any rule actually changed, which is exactly
 * the noise this tool exists to remove.
 */
export const buildLock = (
  source: string,
  version: string,
  files: Record<string, string>,
) => ({
  lockVersion: LOCK_VERSION,
  source,
  version,
  files: sortKeys(files),
});

/** Stable key order so the lock diffs cleanly between syncs. */
const sortKeys = (files: Record<string, string>) => {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(files).sort()) {
    const value = files[key];
    if (value !== undefined) {
      sorted[key] = value;
    }
  }
  return sorted;
};

export const serializeLock = (lock: Lock) =>
  `${JSON.stringify(lock, null, 2)}\n`;

/**
 * Read and validate the lock at `projectRoot`. A missing lock is not an
 * error — it just means this repo has never been synced — so the absent case
 * returns `{ data: null, error: null }` and lets the caller decide.
 */
export const readLock = async (projectRoot: string) => {
  const file = Bun.file(path.join(projectRoot, LOCK_PATH));
  if (!(await file.exists())) {
    return { data: null, error: null };
  }

  const read = await attempt(() => file.text());
  if (read.data === null) {
    return { data: null, error: `${LOCK_PATH} is unreadable: ${read.error}` };
  }

  const parsed = attemptSync(() => JSON.parse(read.data));
  if (parsed.error !== null) {
    return { data: null, error: `${LOCK_PATH} is not valid JSON: ${parsed.error}` };
  }

  return validateLock(parsed.data);
};

const validateLock = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: `${LOCK_PATH} is not a JSON object` };
  }

  const record: Record<string, unknown> = value;
  if (typeof record.source !== "string" || typeof record.version !== "string") {
    return {
      data: null,
      error: `${LOCK_PATH} is missing \`source\` or \`version\``,
    };
  }

  const files = record.files;
  if (typeof files !== "object" || files === null || Array.isArray(files)) {
    return { data: null, error: `${LOCK_PATH} is missing a \`files\` object` };
  }

  const entries: Record<string, string> = {};
  for (const [key, digestValue] of Object.entries(files)) {
    if (typeof digestValue !== "string") {
      return {
        data: null,
        error: `${LOCK_PATH} entry "${key}" is not a string digest`,
      };
    }
    entries[key] = digestValue;
  }

  const lockVersion =
    typeof record.lockVersion === "number" ? record.lockVersion : LOCK_VERSION;

  return {
    data: {
      lockVersion,
      source: record.source,
      version: record.version,
      files: entries,
    } satisfies Lock,
    error: null,
  };
};

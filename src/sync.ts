import { Glob } from "bun";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { attempt } from "./attempt";
import {
  CHECKER_PATH,
  LOCK_PATH,
  RULE_SUFFIXES,
  SOURCE_RULES_DIR,
  TARGET_RULES_DIR,
  WORKFLOW_PATH,
} from "./constants";
import { buildLock, digest, readLock, serializeLock } from "./lock";
import { CHECKER_SOURCE, WORKFLOW_SOURCE } from "./templates";

const isRuleFile = (relativePath: string) =>
  RULE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));

/** Every rule file the plugin ships, as paths relative to `rules/`. */
export const listSourceRules = async (pluginRoot: string) => {
  const root = path.join(pluginRoot, SOURCE_RULES_DIR);

  // Glob.scan throws ENOENT on a missing cwd rather than yielding nothing, so
  // check first and let the caller report "no rules" instead of a raw syscall
  // error surfacing from inside the iterator.
  const stat = await attempt(() => fs.stat(root));
  if (stat.data === null || !stat.data.isDirectory()) {
    return [];
  }

  const found: string[] = [];
  // followSymlinks so a plugin root that is itself a symlink still enumerates.
  for await (const entry of new Glob("**/*").scan({
    cwd: root,
    dot: true,
    followSymlinks: true,
  })) {
    if (isRuleFile(entry)) {
      found.push(entry);
    }
  }
  return found.sort();
};

/**
 * Vendor the plugin's rules into `projectRoot`.
 *
 * Pruning is driven by the *previous* lock rather than by scanning the target
 * directory: only files this tool wrote last time and that no longer exist
 * upstream are removed. Anything else under `.claude/rules/` is a rule the
 * repository owns, and is left strictly alone.
 */
export const sync = async (
  pluginRoot: string,
  projectRoot: string,
  source: string,
  version: string,
  options: { withCi: boolean },
) => {
  const sourceRules = await listSourceRules(pluginRoot);
  if (sourceRules.length === 0) {
    return {
      data: null,
      error: `no rule files found under ${path.join(pluginRoot, SOURCE_RULES_DIR)}`,
    };
  }

  const previous = await readLock(projectRoot);
  if (previous.error !== null) {
    return { data: null, error: previous.error };
  }

  const files: Record<string, string> = {};
  const written: string[] = [];

  for (const relativeRule of sourceRules) {
    const from = path.join(pluginRoot, SOURCE_RULES_DIR, relativeRule);
    const targetRelative = path.posix.join(
      TARGET_RULES_DIR,
      relativeRule.split(path.sep).join("/"),
    );
    const to = path.join(projectRoot, targetRelative);

    const contents = await attempt(() => Bun.file(from).text());
    if (contents.data === null) {
      return { data: null, error: `cannot read ${from}: ${contents.error}` };
    }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await Bun.write(to, contents.data);
    files[targetRelative] = digest(contents.data);
    written.push(targetRelative);
  }

  await Bun.write(path.join(projectRoot, CHECKER_PATH), CHECKER_SOURCE);
  files[CHECKER_PATH] = digest(CHECKER_SOURCE);

  const removed = await prune(projectRoot, previous.data?.files ?? {}, files);

  const lock = buildLock(source, version, files);
  await Bun.write(path.join(projectRoot, LOCK_PATH), serializeLock(lock));

  if (options.withCi) {
    const workflow = path.join(projectRoot, WORKFLOW_PATH);
    await fs.mkdir(path.dirname(workflow), { recursive: true });
    await Bun.write(workflow, WORKFLOW_SOURCE);
  }

  return { data: { written, removed, version, source }, error: null };
};

/**
 * Delete files the previous lock claims we wrote which are no longer part of
 * the current set. Empty directories left behind are removed too, so a
 * retired rule category does not leave a husk.
 */
const prune = async (
  projectRoot: string,
  previousFiles: Record<string, string>,
  currentFiles: Record<string, string>,
) => {
  const removed: string[] = [];

  for (const relativePath of Object.keys(previousFiles)) {
    if (relativePath in currentFiles) {
      continue;
    }
    const absolute = path.join(projectRoot, relativePath);
    const existed = await attempt(() => fs.rm(absolute, { force: true }));
    if (existed.error === null) {
      removed.push(relativePath);
    }
  }

  await removeEmptyDirs(path.join(projectRoot, TARGET_RULES_DIR));
  return removed.sort();
};

const removeEmptyDirs = async (dir: string) => {
  const listing = await attempt(() => fs.readdir(dir, { withFileTypes: true }));
  if (listing.data === null) {
    return;
  }

  for (const entry of listing.data) {
    if (entry.isDirectory()) {
      await removeEmptyDirs(path.join(dir, entry.name));
    }
  }

  const remaining = await attempt(() => fs.readdir(dir));
  if (remaining.data !== null && remaining.data.length === 0) {
    await attempt(() => fs.rmdir(dir));
  }
};

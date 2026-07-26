import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { check } from "./check";
import { CHECKER_PATH, LOCK_PATH, TARGET_RULES_DIR } from "./constants";
import { readLock } from "./lock";
import { sync } from "./sync";

let pluginRoot: string;
let projectRoot: string;

const SOURCE = "claude-rules";
const VERSION = "1.0.0";

beforeEach(async () => {
  pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rules-plugin-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rules-project-"));
  await writeSourceRule("coding/testing.md", "# Testing\n\nColocate tests.\n");
  await writeSourceRule(
    "coding/testing.enforce.toml",
    'id = "coding/testing"\nbody = "./testing.md"\n',
  );
  await writeSourceRule("safety/security.md", "# Security\n\nNo secrets.\n");
});

afterEach(async () => {
  await fs.rm(pluginRoot, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

const writeSourceRule = async (relativePath: string, contents: string) => {
  const abs = path.join(pluginRoot, "rules", relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents);
};

const runSync = () =>
  sync(pluginRoot, projectRoot, SOURCE, VERSION, { withCi: false });

const targetPath = (relativePath: string) =>
  path.join(projectRoot, TARGET_RULES_DIR, relativePath);

describe("sync", () => {
  test("vendors rules as real files and locks every one", async () => {
    const result = await runSync();
    expect(result.error).toBeNull();

    const stat = await fs.lstat(targetPath("coding/testing.md"));
    expect(stat.isSymbolicLink()).toBe(false);
    expect(stat.isFile()).toBe(true);

    const lock = await readLock(projectRoot);
    expect(lock.error).toBeNull();
    expect(lock.data?.source).toBe(SOURCE);
    expect(lock.data?.version).toBe(VERSION);
    // three rule files plus the emitted checker
    expect(Object.keys(lock.data?.files ?? {})).toHaveLength(4);
    expect(lock.data?.files[CHECKER_PATH]).toBeDefined();
  });

  test("carries .enforce.toml across, not just markdown", async () => {
    await runSync();
    const toml = await Bun.file(targetPath("coding/testing.enforce.toml")).text();
    expect(toml).toContain('body = "./testing.md"');
  });

  test("emits a checker and a lock that check() accepts", async () => {
    await runSync();
    const verdict = await check(projectRoot);
    expect(verdict.error).toBeNull();
    expect(verdict.data?.clean).toBe(true);
    expect(verdict.data?.missing).toEqual([]);
    expect(verdict.data?.modified).toEqual([]);
  });

  test("the lock carries no timestamp, so a re-sync produces no diff", async () => {
    await runSync();
    const first = await Bun.file(path.join(projectRoot, LOCK_PATH)).text();
    await runSync();
    const second = await Bun.file(path.join(projectRoot, LOCK_PATH)).text();
    expect(second).toBe(first);
  });

  test("prunes files retired upstream", async () => {
    await runSync();
    expect(await Bun.file(targetPath("safety/security.md")).exists()).toBe(true);

    await fs.rm(path.join(pluginRoot, "rules/safety/security.md"));
    const result = await runSync();

    expect(result.data?.removed).toEqual([`${TARGET_RULES_DIR}/safety/security.md`]);
    expect(await Bun.file(targetPath("safety/security.md")).exists()).toBe(false);
    // the emptied category directory should not linger
    expect(
      await fs
        .stat(path.join(projectRoot, TARGET_RULES_DIR, "safety"))
        .then(() => true, () => false),
    ).toBe(false);
  });

  test("leaves the repository's own rules alone through sync and check", async () => {
    await runSync();

    const ownRule = targetPath("project-only.md");
    await fs.writeFile(ownRule, "# Local\n\nThis repo's own rule.\n");
    await runSync();

    expect(await Bun.file(ownRule).text()).toContain("This repo's own rule");

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(true);
  });

  test("--with-ci writes the workflow, and omitting it does not", async () => {
    const workflow = path.join(projectRoot, ".github/workflows/rules-check.yml");
    await runSync();
    expect(await Bun.file(workflow).exists()).toBe(false);

    await sync(pluginRoot, projectRoot, SOURCE, VERSION, { withCi: true });
    expect(await Bun.file(workflow).text()).toContain("node .claude/rules-check.mjs");
  });

  test("reports an error when the plugin ships no rules", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "rules-empty-"));
    const result = await sync(empty, projectRoot, SOURCE, VERSION, {
      withCi: false,
    });
    await fs.rm(empty, { recursive: true, force: true });

    expect(result.data).toBeNull();
    expect(result.error).toContain("no rule files found");
  });
});

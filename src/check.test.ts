import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { check } from "./check";
import { CHECKER_PATH, LOCK_PATH, TARGET_RULES_DIR } from "./constants";
import { sync } from "./sync";

let pluginRoot: string;
let projectRoot: string;

beforeEach(async () => {
  pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), "check-plugin-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "check-project-"));
  const rule = path.join(pluginRoot, "rules/coding/testing.md");
  await fs.mkdir(path.dirname(rule), { recursive: true });
  await fs.writeFile(rule, "# Testing\n\nColocate tests.\n");
  await sync(pluginRoot, projectRoot, "claude-rules", "1.0.0", {
    withCi: false,
  });
});

afterEach(async () => {
  await fs.rm(pluginRoot, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

const vendored = path.posix.join(TARGET_RULES_DIR, "coding/testing.md");

describe("check", () => {
  test("catches a hand-edited vendored rule", async () => {
    await fs.writeFile(
      path.join(projectRoot, vendored),
      "# Testing\n\nEdited in place, which is the thing we are preventing.\n",
    );

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(false);
    expect(verdict.data?.modified).toEqual([vendored]);
    expect(verdict.data?.missing).toEqual([]);
  });

  test("catches a deleted vendored rule", async () => {
    await fs.rm(path.join(projectRoot, vendored));

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(false);
    expect(verdict.data?.missing).toEqual([vendored]);
  });

  test("catches tampering with the emitted checker itself", async () => {
    await fs.writeFile(
      path.join(projectRoot, CHECKER_PATH),
      "process.exit(0);\n",
    );

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(false);
    expect(verdict.data?.modified).toContain(CHECKER_PATH);
  });

  test("ignores line-ending churn from a Windows checkout", async () => {
    const original = await Bun.file(path.join(projectRoot, vendored)).text();
    await fs.writeFile(
      path.join(projectRoot, vendored),
      original.replace(/\n/g, "\r\n"),
    );

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(true);
  });

  test("errors clearly when the repo has never been synced", async () => {
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), "check-fresh-"));
    const verdict = await check(fresh);
    await fs.rm(fresh, { recursive: true, force: true });

    expect(verdict.data).toBeNull();
    expect(verdict.error).toContain("has not been synced");
  });

  test("errors clearly on a corrupt lock rather than passing", async () => {
    await fs.writeFile(path.join(projectRoot, LOCK_PATH), "{ not json");

    const verdict = await check(projectRoot);
    expect(verdict.data).toBeNull();
    expect(verdict.error).toContain("not valid JSON");
  });

  test("a sync after tampering restores the locked content", async () => {
    await fs.writeFile(path.join(projectRoot, vendored), "# Tampered\n");
    await sync(pluginRoot, projectRoot, "claude-rules", "1.0.0", {
      withCi: false,
    });

    const verdict = await check(projectRoot);
    expect(verdict.data?.clean).toBe(true);
  });
});

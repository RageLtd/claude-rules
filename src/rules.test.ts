/**
 * Detector precision tests for the enforce rules that have earned them.
 *
 * Mirrors what Mimir's engine does with a `.enforce.toml`: compile each
 * `regex_match` pattern with `new RegExp` (no flags) and test it against
 * the raw field. A rule only fires when every condition matches and no
 * negative condition does. These cases are the false positives that were
 * observed in the wild and must never come back.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

type Condition = { field: string; operator: string; pattern: string };
type Rule = {
  id: string;
  severity?: string;
  conditions?: Condition[];
  negative_conditions?: Condition[];
};

const RULES = join(import.meta.dir, "..", "rules");

const loadRule = async (relative: string) => {
  const text = await Bun.file(join(RULES, relative)).text();
  return Bun.TOML.parse(text) as Rule;
};

const compile = (conditions: Condition[] | undefined) =>
  (conditions ?? []).map((c) => {
    if (c.operator !== "regex_match") {
      throw new Error(`test only handles regex_match, got ${c.operator}`);
    }
    return new RegExp(c.pattern);
  });

/** True when the rule would fire on this command, per the engine's AND / AND-NOT. */
const fires = (rule: Rule, command: string) =>
  compile(rule.conditions).every((re) => re.test(command)) &&
  !compile(rule.negative_conditions).some((re) => re.test(command));

const rule = await loadRule("safety/no-pipe-swallowing.enforce.toml");

describe("safety/no-pipe-swallowing", () => {
  test.each([
    "atlas schema inspect --env local 2>&1 | grep -c 'table \"'",
    "atlas schema apply --dry-run 2>&1 | head -5",
    "some-command 2>&1 | tail -20",
    "bun test | tail -n 20",
    "cargo build 2>&1 | grep error",
    "git status --short | wc -l",
    "cmd | grep x | head",
    "make lint && bun test | grep fail",
  ])("fires: %s", (command) => {
    expect(fires(rule, command)).toBe(true);
  });

  test.each([
    // A pipe character inside a quoted argument is not a pipe.
    'grep -n "current\\|Currently\\|head is" AGENTS.md',
    "grep -E 'foo|head' file.txt",
    'rg "a|tail" src/',
    // A filter feeding a filter hides nothing.
    "grep -n foo file.txt | sed -n 1,5p",
    "grep -rn foo src/ | head -n 20",
    "cat file.txt | grep x",
    "echo hello | wc -c",
    "sed -n 1,20p a.txt | grep x",
    "ls -la | grep total",
    "find . -name '*.ts' | head",
    "jq -r .name pkg.json | tr -d '\"'",
    // stderr captured to a file before the pipe is preserved.
    "bun test 2>err.log | tail -n 20",
    "cargo build 2> /tmp/build.log | grep warning",
    // No pipe into a filter at all.
    "bun test",
    "git log --oneline -5",
    "cat a.txt > b.txt",
  ])("stays quiet: %s", (command) => {
    expect(fires(rule, command)).toBe(false);
  });

  test("captures the filter name for the message", () => {
    const [re] = compile(rule.conditions);
    expect(re?.exec("bun test | tail -n 20")?.[1]).toBe("tail");
  });
});

describe("severity pins", () => {
  test.each([
    "coding/functional-style.enforce.toml",
    "coding/return-types.enforce.toml",
    "coding/control-braces.enforce.toml",
  ])("%s advises rather than blocks", async (relative) => {
    expect((await loadRule(relative)).severity).toBe("nudge");
  });

  test.each([
    "safety/no-pipe-swallowing.enforce.toml",
    "safety/push-target.enforce.toml",
    "safety/pr-lifecycle.enforce.toml",
    "quality/file-length.enforce.toml",
  ])("%s keeps the blocking default", async (relative) => {
    expect((await loadRule(relative)).severity).toBeUndefined();
  });
});

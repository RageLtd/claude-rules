# No Pipe Swallowing (CRITICAL)

NEVER pipe the output of commands directly into `head`, `tail`, `grep`, `wc`, or other filters. This hides errors — if the command fails, the pipe silently swallows stderr or returns misleading results.

## Wrong

```bash
atlas schema inspect --env local 2>&1 | grep -c 'table "'
atlas schema apply --dry-run 2>&1 | head -5
some-command 2>&1 | tail -20
```

## Correct

Run the command first, capture output to a file or variable, THEN filter:

```bash
# Capture to file, then inspect
atlas schema inspect --env local > /tmp/out.txt 2>&1
grep -c 'table "' /tmp/out.txt

# Or check exit code first
atlas schema apply --dry-run 2>&1
# Then in a separate command, filter the output
```

This ensures errors are visible and not silently discarded by downstream pipe stages.

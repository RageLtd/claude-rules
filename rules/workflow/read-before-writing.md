# Read Before Writing (CRITICAL)

**Before writing ANY code that calls another service, API, CLI tool, or route: read the target's source code or docs first.** No exceptions. Never guess at URLs, flag names, route paths, port numbers, or parameter formats.

## Hard Rules

1. **Before writing a fetch/HTTP call**: Read the target service's route definitions to get the exact path.
2. **Before using a CLI flag**: Run `--help` and read the output. Don't assume flag names or syntax.
3. **Before assuming service architecture**: Check deployment config (railway.toml, docker-compose, workflow files).
4. **Before constructing a URL**: Verify host, port, and protocol from the actual config — not by transforming another URL.

## Stop-After-Failure Rule

After **1 failed attempt** at any approach:
- **Stop implementing.**
- Re-read the relevant source code, config, or docs.
- Only resume once you have evidence for why the first attempt failed.

After **2 failed attempts** at the same problem:
- **Stop and reconsider the entire approach.** The framing may be wrong.
- Ask the user if unsure, rather than trying a 3rd variation.

**Never spiral through 3+ guesses.** Each guess burns the user's time and trust. One informed attempt is worth five guesses.

## Anti-Patterns

- ❌ "The route is probably `/login`" → write code → 404 → "oh, it's `/auth/login`"
- ❌ "This flag probably works like..." → error → try another flag → error → try another
- ❌ User says "do X" → "X won't work because..." → do Y instead → Y fails → do Z → Z fails → finally do X

## Correct Pattern

- ✅ Read `server.ts` → see `app.route("/auth/login", login)` → write `fetch(\`\${url}/auth/login\`)`
- ✅ Run `atlas schema apply --help` → see `--exclude` takes glob patterns → use correct syntax
- ✅ User says "do X" → try X → if X fails, re-read and understand why before proposing alternatives

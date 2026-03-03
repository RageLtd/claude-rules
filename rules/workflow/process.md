# Workflow

## Plan First
Present plan, wait for approval, then execute. No silent action. Approvals are per-message. Re-plan when scope changes.

## Task Startup Order
1. **Memory** — check goldfish for past context on this topic
2. **Docs** — fetch current docs via Context7 for any API/library involved
3. **Code** — explore codebase with WarpGrep for broad queries, standard grep for keywords

## External Tools
Read official docs before using any external tool or dependency. Verify docs match the pinned version. Use Context7 when available. Never guess at API surfaces.

## Stop Conditions
Stop and escalate when: tool failures exceed 2 retries, scope grows beyond agreement, required info is unavailable, or blocked with no approved workaround.

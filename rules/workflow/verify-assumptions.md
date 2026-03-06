# Verify Assumptions Before Acting

Never act on assumptions about what went wrong. Always validate first.

- When a result is unexpected, **inspect the actual return value** before changing code.
- When an API call fails or behaves oddly, read the response (status, body, headers) before hypothesizing a fix.
- When a test fails, read the actual vs expected output before modifying the test or the code under test.
- When a deployment or build breaks, check logs and error messages before guessing at the cause.

**Bad:** "This didn't work" → immediately change the code.
**Good:** "This didn't work" → examine what actually happened → change code based on evidence.

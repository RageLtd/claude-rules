# A Running Service Must Look Alive

An operator reading the logs must be able to tell a working process from a hung one. Silence is not a status.

Every long-running service or job logs, at info level, at minimum:

- **Startup**: one line when it is ready, naming what it listens on and the configuration that matters (never secrets).
- **Background work**: a line when a job starts and a line when it ends, with the outcome and duration.
- **Progress**: any operation that can run longer than a minute logs progress at a steady interval — items done of total, not a line per item.
- **Shutdown**: one line on a clean stop.

Log to standard output, one event per line. A step that fails logs what failed and why at the moment it fails, not only in an end-of-run summary.

Per-request and per-item detail belongs at debug level, not info.

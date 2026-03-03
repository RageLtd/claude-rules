# Reuse Long-Lived Processes

Prefer connecting to an existing process over spawning a new one. Use a "get or start" pattern: check if a service is already healthy, and only spawn if it isn't.

Track ownership so only the process that spawned a service is responsible for stopping it.

# Dependency Management

Prefer stdlib and existing dependencies before adding new packages. Justify any new dependency with a clear reason (complexity it removes, maintenance burden it avoids). One-function packages are almost never worth it.

Always add dependencies using the project's package manager (`bun add`, `npm install`, `cargo add`, etc.). Never manually edit dependency lists in manifest files.

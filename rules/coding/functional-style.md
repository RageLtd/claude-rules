# Functional Style (CRITICAL)

Prefer pure functions, immutable data, and composition across all languages.

- **TypeScript/JavaScript**: No classes. Use plain objects, closures, and module-level functions.
- **Rust**: Prefer data structs + trait impls over OOP patterns. Use enums for variants.
- **Go**: Prefer plain structs + interface satisfaction. No embedded struct hierarchies for polymorphism.

No inheritance or mutable shared state without explicit approval.

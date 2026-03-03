# Error Handling

Propagate errors explicitly — never catch and silence.

- **TypeScript/JavaScript**: Use `{ data, error }` result objects instead of try/catch.
- **Rust**: Use `Result<T, E>` and the `?` operator. Avoid `.unwrap()` outside of tests.
- **Go**: Return `(val, error)` and always check `err`. No blank `_` on error returns.

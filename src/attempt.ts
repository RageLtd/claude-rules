/**
 * The one place in this package allowed to catch.
 *
 * `JSON.parse` and the filesystem throw; the rest of the codebase returns
 * `{ data, error }`. Isolating the conversion here keeps try/catch out of
 * business logic while still handling the boundaries where exceptions are
 * the only signal available.
 */

export const attemptSync = <T>(fn: () => T) => {
  try {
    return { data: fn(), error: null };
  } catch (cause) {
    return { data: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
};

export const attempt = async <T>(fn: () => Promise<T>) => {
  return fn().then(
    (data) => ({ data, error: null }),
    (cause) => ({
      data: null,
      error: cause instanceof Error ? cause.message : String(cause),
    }),
  );
};

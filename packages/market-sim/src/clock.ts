/**
 * The only way the engine learns the time.
 * Source: ADR-007 point 7, 12-demo-mode-spec.md §40.
 *
 * The shape matches the application `Clock` port, so the same object satisfies both. The
 * engine depends only on `@trading/domain`, so it declares its own copy instead of importing
 * the application one. Nothing in this package calls `new Date()` or `Date.now()`.
 */
export interface Clock {
  now(): Date;
}

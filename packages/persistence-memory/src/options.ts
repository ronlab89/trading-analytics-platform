export interface InMemoryRepositoryOptions {
  /** Source of timestamps; defaults to the system clock. Tests inject a deterministic one. */
  now?: () => Date;
}

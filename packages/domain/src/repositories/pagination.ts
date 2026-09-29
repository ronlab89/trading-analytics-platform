/**
 * Pagination primitives shared by every list-style repository contract.
 * Source: 07-api-spec.md §40 (Pagination).
 *
 * Deliberately transport-agnostic: `page` is 1-based, and `Page` carries
 * the total match count so the API layer can derive `totalPages`
 * (07-api-spec.md §4) without the repository knowing about HTTP.
 */
export interface PageRequest {
  /** 1-based page number. */
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** Total number of records matching the filter, across all pages. */
  readonly total: number;
}

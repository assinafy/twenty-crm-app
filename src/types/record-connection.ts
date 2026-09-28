// A Twenty query result connection as the app reads it. Query results are assigned to it rather than cast, so the
// generated client still checks its result against what the app reads, and the fresh-install client stub (which types
// every result as any) still typechecks.
export type RecordConnection<T> = { edges: Array<{ node: T }> };

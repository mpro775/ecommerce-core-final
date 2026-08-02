export interface QueryExecutor {
  query<T = unknown>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}


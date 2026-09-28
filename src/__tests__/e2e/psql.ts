import { dockerExec } from 'src/__tests__/e2e/docker-exec';

// Runs SQL on the test container's database and returns the rows as objects. The statement travels in an environment
// variable, so it needs no shell quoting. Only used for what no API exposes (the app key-value store, connection
// timestamps).
export const psql = async <TRow = Record<string, unknown>>(sql: string): Promise<TRow[]> => {
  const isQuery = /^\s*(select|with)\b/i.test(sql);
  const statement = isQuery ? `select coalesce(json_agg(q), '[]'::json) from (${sql}) q` : sql;
  const output = await dockerExec(['sh', '-c', 'psql "$PG_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$E2E_SQL"'], {
    env: { E2E_SQL: statement },
  });
  return isQuery ? (JSON.parse(output.trim()) as TRow[]) : [];
};

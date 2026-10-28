import { psql } from 'src/__tests__/e2e/psql';

export const findAssinafyDocumentTable = async (): Promise<string> => {
  const tables = await psql<{ schema: string; table: string }>(
    `select table_schema as schema, table_name as table from information_schema.tables
     where table_name in ('assinafyDocument', '_assinafyDocument') and table_schema like 'workspace_%'`,
  );
  const location = tables.length === 1 ? tables[0] : undefined;
  if (!location || !/^workspace_[a-zA-Z0-9_-]+$/.test(location.schema) ||
    !['assinafyDocument', '_assinafyDocument'].includes(location.table)) {
    throw new Error('Unexpected local fixture table');
  }
  return `"${location.schema}"."${location.table}"`;
};

import { psql } from 'src/__tests__/e2e/psql';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rows of a core metadata table that belong to an application (by id, so they are found even after uninstall).
export const appRows = <TRow = Record<string, unknown>>(applicationId: string, table: string, columns: string): Promise<TRow[]> => {
  if (!UUID.test(applicationId) || !/^[A-Za-z]+$/.test(table)) throw new Error('Invalid application id or table.');
  return psql<TRow>(`select ${columns} from core."${table}" where "applicationId" = '${applicationId}'`);
};

export const appUniversalIdentifiers = async (applicationId: string, table: string): Promise<string[]> =>
  (await appRows<{ universalIdentifier: string }>(applicationId, table, '"universalIdentifier"')).map(
    ({ universalIdentifier }) => universalIdentifier,
  );

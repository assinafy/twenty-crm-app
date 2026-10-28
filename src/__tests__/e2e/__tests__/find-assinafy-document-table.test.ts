import { describe, expect, it, vi } from 'vitest';

import { findAssinafyDocumentTable } from 'src/__tests__/e2e/find-assinafy-document-table';
import { psql } from 'src/__tests__/e2e/psql';

vi.mock('src/__tests__/e2e/psql', () => ({ psql: vi.fn<typeof psql>() }));

describe('findAssinafyDocumentTable', () => {
  it.each(['assinafyDocument', '_assinafyDocument'])('locates the %s physical table', async (table) => {
    vi.mocked(psql).mockResolvedValueOnce([{ schema: 'workspace_test', table }]);
    await expect(findAssinafyDocumentTable()).resolves.toBe(`"workspace_test"."${table}"`);
  });

  it.each([
    { tables: [] },
    { tables: [{ schema: 'workspace_first', table: '_assinafyDocument' }, { schema: 'workspace_second', table: '_assinafyDocument' }] },
    { tables: [{ schema: 'public', table: '_assinafyDocument' }] },
    { tables: [{ schema: 'workspace_test"', table: '_assinafyDocument' }] },
    { tables: [{ schema: 'workspace_test', table: 'person' }] },
  ])('rejects a missing, ambiguous or unexpected location: $tables', async ({ tables }) => {
    vi.mocked(psql).mockResolvedValueOnce(tables);
    await expect(findAssinafyDocumentTable()).rejects.toThrow('Unexpected local fixture table');
  });
});

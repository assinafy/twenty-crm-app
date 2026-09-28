import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { createAssinafyDocument } from 'src/data/create-assinafy-document';
import { AppFailure } from 'src/utils/app-failure.util';

const data = {
  name: 'Contract',
  status: 'SENDING' as const,
  requestId: 'request-1',
  assinafyAccountId: 'account-1',
  personId: 'person-1',
};

describe('createAssinafyDocument', () => {
  it('creates the record with the full selection and maps it', async () => {
    const { core, mutation } = fakeCore({
      createAssinafyDocument: { id: 'record-1', ...data, updatedAt: '2026-01-02T00:00:00.000Z' },
    });

    const record = await createAssinafyDocument(core, data);

    expect(mutation).toHaveBeenCalledWith({
      createAssinafyDocument: { __args: { data }, ...ASSINAFY_DOCUMENT_SELECTION },
    });
    expect(record).toMatchObject({ id: 'record-1', status: 'SENDING', requestId: 'request-1', personId: 'person-1' });
  });

  it('fails when Twenty returns no record', async () => {
    const { core } = fakeCore({ createAssinafyDocument: null });

    await expect(createAssinafyDocument(core, data)).rejects.toMatchObject(
      new AppFailure('INTERNAL', 'O Twenty não retornou o documento criado.'),
    );
  });

  it('lets a duplicate requestId error reach the caller', async () => {
    const { core, mutation } = fakeCore(null);
    const duplicate = new Error('A duplicate entry was detected: unique constraint x was violated');
    mutation.mockRejectedValue(duplicate);

    await expect(createAssinafyDocument(core, data)).rejects.toBe(duplicate);
  });
});

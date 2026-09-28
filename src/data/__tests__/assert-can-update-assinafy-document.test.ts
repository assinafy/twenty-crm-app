import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';

const record = { id: 'record-1', lastSyncedAt: '2026-09-25T12:00:00.000Z' };

// Same shape as the client's GenqlError: message joins errors[].message.
const genqlError = (errors: Array<{ message: string; extensions?: { code: string } }>) =>
  Object.assign(new Error(errors.map((entry) => entry.message).join('\n')), { errors });

describe('assertCanUpdateAssinafyDocument', () => {
  it('writes lastSyncedAt back unchanged with the given client', async () => {
    const { core, mutation } = fakeCore({ updateAssinafyDocument: { id: 'record-1' } });

    await expect(assertCanUpdateAssinafyDocument(core, record)).resolves.toBeUndefined();
    expect(mutation).toHaveBeenCalledWith({
      updateAssinafyDocument: {
        __args: { id: 'record-1', data: { lastSyncedAt: '2026-09-25T12:00:00.000Z' } },
        ...ASSINAFY_DOCUMENT_SELECTION,
      },
    });
  });

  it('writes back a missing lastSyncedAt as null', async () => {
    const { core, mutation } = fakeCore({ updateAssinafyDocument: { id: 'record-1' } });

    await assertCanUpdateAssinafyDocument(core, { id: 'record-1', lastSyncedAt: null });

    expect(mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        updateAssinafyDocument: expect.objectContaining({ __args: { id: 'record-1', data: { lastSyncedAt: null } } }),
      }),
    );
  });

  it('answers FORBIDDEN when the member role cannot update the record', async () => {
    const { core, mutation } = fakeCore(null);
    mutation.mockRejectedValue(genqlError([{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }]));

    await expect(assertCanUpdateAssinafyDocument(core, record)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Sua função no Twenty não permite alterar este documento.',
      details: { reason: 'member_permission' },
    });
  });

  it('rethrows any other failure unchanged instead of reporting a permission problem', async () => {
    const { core, mutation } = fakeCore(null);
    const failure = new TypeError('fetch failed');
    mutation.mockRejectedValue(failure);

    await expect(assertCanUpdateAssinafyDocument(core, record)).rejects.toBe(failure);
  });

  it('rethrows NOT_FOUND when the record disappeared', async () => {
    const { core } = fakeCore({ updateAssinafyDocument: null });

    await expect(assertCanUpdateAssinafyDocument(core, record)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

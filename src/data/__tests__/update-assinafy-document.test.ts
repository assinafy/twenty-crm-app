import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { AppFailure } from 'src/utils/app-failure.util';

describe('updateAssinafyDocument', () => {
  it('updates by id with a Twenty-writable patch and maps the result', async () => {
    const { core, mutation } = fakeCore({
      updateAssinafyDocument: { id: 'record-1', status: 'CERTIFICATED', updatedAt: '2026-01-02T00:00:00.000Z' },
    });

    const record = await updateAssinafyDocument(core, 'record-1', {
      status: 'CERTIFICATED',
      signedDocument: [{ fileId: 'file-1', label: 'a - assinado.pdf', url: null }],
    });

    expect(mutation).toHaveBeenCalledWith({
      updateAssinafyDocument: {
        __args: {
          id: 'record-1',
          data: { status: 'CERTIFICATED', signedDocument: [{ fileId: 'file-1', label: 'a - assinado.pdf' }] },
        },
        ...ASSINAFY_DOCUMENT_SELECTION,
      },
    });
    expect(record).toMatchObject({ id: 'record-1', status: 'CERTIFICATED' });
  });

  it('fails with NOT_FOUND when Twenty reports the record missing', async () => {
    const { core, mutation } = fakeCore({});
    mutation.mockRejectedValue(
      Object.assign(new Error('Record not found'), {
        errors: [{ message: 'Record not found', extensions: { code: 'NOT_FOUND', subCode: 'RECORD_NOT_FOUND' } }],
        data: { updateAssinafyDocument: null },
      }),
    );

    const failure = updateAssinafyDocument(core, 'record-1', { lastError: null });
    await expect(failure).rejects.toBeInstanceOf(AppFailure);
    await expect(failure).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rethrows any other error unchanged', async () => {
    const denied = permissionDenied();
    const { core, mutation } = fakeCore({});
    mutation.mockRejectedValue(denied);

    await expect(updateAssinafyDocument(core, 'record-1', { lastError: null })).rejects.toBe(denied);
  });

  it('fails with NOT_FOUND when Twenty returns no record', async () => {
    const { core } = fakeCore({ updateAssinafyDocument: null });

    await expect(updateAssinafyDocument(core, 'record-1', { lastError: null })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

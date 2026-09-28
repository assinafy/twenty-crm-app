import { describe, expect, it } from 'vitest';

import { toAssinafyDocumentInput } from 'src/data/to-assinafy-document-input';
import { type StoredSigner } from 'src/types/stored-signer';

const signer: StoredSigner = {
  id: 'signer-1',
  name: 'Ana Test',
  email: 'ana@example.invalid',
  phone: null,
  verificationMethod: 'Email',
  notificationMethod: 'Email',
  step: 1,
  notified: true,
  completed: null,
  deliveryFailed: false,
  declined: false,
};

describe('toAssinafyDocumentInput', () => {
  it('drops the read-only url from stored files and passes signers through', () => {
    expect(
      toAssinafyDocumentInput({
        status: 'CERTIFICATED',
        signers: [signer],
        signedDocument: [{ fileId: 'file-1', label: 'a - assinado.pdf', url: 'https://files.test.invalid/1' }],
      }),
    ).toEqual({
      status: 'CERTIFICATED',
      signers: [signer],
      signedDocument: [{ fileId: 'file-1', label: 'a - assinado.pdf' }],
    });
  });

  it('keeps explicit nulls', () => {
    expect(toAssinafyDocumentInput({ signers: null, signedDocument: null, lastError: null })).toEqual({
      signers: null,
      signedDocument: null,
      lastError: null,
    });
  });

  it('leaves absent fields out so an update never clears them', () => {
    expect(toAssinafyDocumentInput({ lastSyncedAt: '2026-01-02T00:00:00.000Z' })).toEqual({
      lastSyncedAt: '2026-01-02T00:00:00.000Z',
    });
  });
});

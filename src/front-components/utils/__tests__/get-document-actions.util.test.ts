import { describe, expect, it } from 'vitest';

import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { getDocumentActions } from 'src/front-components/utils/get-document-actions.util';
import { type StoredSigner } from 'src/types/stored-signer';

const signer = (id: string, overrides: Partial<StoredSigner> = {}): StoredSigner =>
  buildStoredSigner({ id, name: id, email: null, ...overrides });

describe('getDocumentActions', () => {
  it('offers cancel and resend to notified, unsigned signers of a pending document', () => {
    expect(
      getDocumentActions({
        status: 'PENDING_SIGNATURE',
        assinafyDocumentId: 'doc-1',
        signers: [
          signer('invited'),
          signer('unknown-completion', { completed: null }),
          signer('signed', { completed: true }),
          signer('waiting', { notified: false }),
          signer('unreported', { notified: null }),
        ],
      }),
    ).toEqual({ cancel: true, remove: false, resendSignerIds: ['invited', 'unknown-completion'] });
  });

  it('handles a pending document without stored signers', () => {
    expect(
      getDocumentActions({ status: 'PENDING_SIGNATURE', assinafyDocumentId: 'doc-1', signers: null }).resendSignerIds,
    ).toEqual([]);
  });

  it.each([
    ['FAILED', 'doc-1', true],
    ['UNCERTAIN', null, true],
    ['UNCERTAIN', 'doc-1', false],
    ['CERTIFICATED', 'doc-1', false],
  ] as const)('removes a %s document with id %s: %s', (status, assinafyDocumentId, remove) => {
    expect(getDocumentActions({ status, assinafyDocumentId, signers: [signer('a')] })).toEqual({
      cancel: false,
      remove,
      resendSignerIds: [],
    });
  });
});

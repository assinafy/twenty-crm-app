import { describe, expect, it, vi } from 'vitest';

import { estimate, prepared, reviewState } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { buildSendRequest } from 'src/front-components/utils/build-send-request.util';

describe('buildSendRequest', () => {
  it('mints a request id and carries the reviewed account and cost', () => {
    const mint = vi.fn<() => string>(() => 'request-1');
    const state = reviewState({ prepared: prepared({ estimate: estimate({ totalCredits: 2.45, documents: 1 }) }) });

    expect(buildSendRequest(state, mint)).toMatchObject({
      requestId: 'request-1',
      accountId: 'account-1',
      expectedTotalCredits: 2.45,
      expectedDocuments: 1,
      assinafyDocumentId: 'doc-1',
      name: 'Contract',
    });
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('reuses the request id of a retry', () => {
    const mint = vi.fn<() => string>(() => 'request-2');

    expect(buildSendRequest(reviewState({ requestId: 'request-1' }), mint)?.requestId).toBe('request-1');
    expect(mint).not.toHaveBeenCalled();
  });

  it('needs a reviewed estimate', () => {
    expect(buildSendRequest(reviewState({ prepared: null }), () => 'request-1')).toBeNull();
  });
});

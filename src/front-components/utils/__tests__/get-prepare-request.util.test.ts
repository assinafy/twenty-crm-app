import { describe, expect, it } from 'vitest';

import { CONTRACT_ID, RECORD_ID, reviewState } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { getPrepareRequest } from 'src/front-components/utils/get-prepare-request.util';

describe('getPrepareRequest', () => {
  const state = reviewState();

  it('re-estimates the reusable upload without discarding it', () => {
    const { body, discard } = getPrepareRequest(state);

    expect(body).toMatchObject({
      recordId: RECORD_ID,
      source: { type: 'PDF', attachmentId: CONTRACT_ID },
      assinafyDocumentId: 'doc-1',
    });
    expect(discard).toBeNull();
  });

  it('discards an upload that no longer matches and uploads again', () => {
    const { body, discard } = getPrepareRequest({ ...state, draft: { ...state.draft, name: 'Renamed' } });

    expect(body.assinafyDocumentId).toBeNull();
    expect(discard).toEqual({ assinafyDocumentId: 'doc-1', accountId: 'account-1' });
  });

  it('never discards an upload a send was attempted with', () => {
    const upload = { ...state.upload!, sendAttempted: true };

    expect(getPrepareRequest({ ...state, upload, draft: { ...state.draft, name: 'Renamed' } }).discard).toBeNull();
  });

  it('has nothing to discard without an upload', () => {
    expect(getPrepareRequest({ ...state, upload: null }).discard).toBeNull();
  });
});

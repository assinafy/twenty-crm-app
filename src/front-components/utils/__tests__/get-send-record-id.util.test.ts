import { describe, expect, it } from 'vitest';

import { reviewState, summary } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { getSendRecordId } from 'src/front-components/utils/get-send-record-id.util';
import { sendFlowReducer } from 'src/front-components/utils/send-flow-reducer.util';

describe('getSendRecordId', () => {
  it('points an uncertain send at the record the server kept', () => {
    const uncertain = sendFlowReducer(
      sendFlowReducer(reviewState({ confirmed: true }), { type: 'SEND_STARTED', requestId: 'request-1' }),
      {
        type: 'SEND_FAILED',
        error: { code: 'UNCERTAIN', message: '', details: { documentRecordId: 'record-doc-9' } },
      },
    );

    expect(uncertain).toMatchObject({ step: 'ERROR', result: null });
    expect(getSendRecordId(uncertain)).toBe('record-doc-9');
  });

  it('prefers the summary of the answer', () => {
    expect(
      getSendRecordId({ result: summary(), error: { code: 'UNCERTAIN', message: '', details: { documentRecordId: 'x' } } }),
    ).toBe('record-doc-1');
  });

  it('returns null without a record', () => {
    expect(getSendRecordId({ result: null, error: null })).toBeNull();
    expect(
      getSendRecordId({ result: null, error: { code: 'UNCERTAIN', message: '', details: { documentRecordId: 3 } } }),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { CONTEXT } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { isSendBlockedByRecentSends } from 'src/front-components/utils/is-send-blocked-by-recent-sends.util';

const recent = { documentRecordId: 'doc-record-1', name: 'Contrato', status: 'PENDING_SIGNATURE' as const };

describe('isSendBlockedByRecentSends', () => {
  it('blocks a new flow on a record with a recent send until the member acknowledges it', () => {
    // A reopened flow starts without the request id of the attempt whose answer was lost.
    const { context, requestId } = createSendFlowState({ ...CONTEXT, recentSends: [recent] });

    expect(requestId).toBeNull();
    expect(isSendBlockedByRecentSends(context, false)).toBe(true);
    expect(isSendBlockedByRecentSends(context, true)).toBe(false);
  });

  it('never blocks without recent sends', () => {
    expect(isSendBlockedByRecentSends(CONTEXT, false)).toBe(false);
  });
});

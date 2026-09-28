import { describe, expect, it } from 'vitest';

import { assignment } from 'src/services/__tests__/service-fixtures';
import { isUnsentDocument } from 'src/utils/is-unsent-document.util';

describe('isUnsentDocument', () => {
  it.each(['uploading', 'uploaded', 'metadata_processing', 'METADATA_READY'])('is true for the draft %s', (status) => {
    expect(isUnsentDocument({ status, assignment: null })).toBe(true);
  });

  it.each(['pending_signature', 'certificated', 'expired', 'failed', 'archived'])(
    'is false once past draft (%s)',
    (status) => {
      expect(isUnsentDocument({ status, assignment: null })).toBe(false);
    },
  );

  it('is false for a draft with an assignment', () => {
    expect(isUnsentDocument({ status: 'uploaded', assignment: assignment() })).toBe(false);
  });
});

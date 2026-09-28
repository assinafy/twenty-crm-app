import { describe, expect, it } from 'vitest';

import { assertReusableUpload } from 'src/utils/assert-reusable-upload.util';

describe('assertReusableUpload', () => {
  it('accepts an unassigned draft of the same workspace', () => {
    const draft = { account_id: 'acc', status: 'uploaded', assignment: null };

    expect(() => assertReusableUpload(draft, 'acc')).not.toThrow();
  });

  it.each([
    ['another workspace', { account_id: 'other', status: 'uploaded', assignment: null }],
    ['a sent document', { account_id: 'acc', status: 'pending_signature', assignment: null }],
  ])('refuses %s', (_label, details) => {
    expect(() => assertReusableUpload(details, 'acc')).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
  });
});

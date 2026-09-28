import { describe, expect, it } from 'vitest';

import { assignment } from 'src/services/__tests__/service-fixtures';
import { isDeletableUpload } from 'src/utils/is-deletable-upload.util';

describe('isDeletableUpload', () => {
  it.each(['uploaded', 'metadata_ready', 'failed', 'FAILED'])('is true for an unassigned %s upload', (status) => {
    expect(isDeletableUpload({ account_id: 'acc', status, assignment: null }, 'acc')).toBe(true);
  });

  it.each(['pending_signature', 'expired', 'certificated'])('is false once sent (%s)', (status) => {
    expect(isDeletableUpload({ account_id: 'acc', status, assignment: null }, 'acc')).toBe(false);
  });

  it.each(['failed', 'uploaded'])('is false for a %s upload with an assignment', (status) => {
    expect(isDeletableUpload({ account_id: 'acc', status, assignment: assignment() }, 'acc')).toBe(false);
  });

  it('is false for an upload of another Assinafy workspace', () => {
    expect(isDeletableUpload({ account_id: 'other', status: 'uploaded', assignment: null }, 'acc')).toBe(false);
  });
});

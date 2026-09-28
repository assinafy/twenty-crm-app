import { describe, expect, it } from 'vitest';

import { reviewState } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { getReusableUploadId } from 'src/front-components/utils/get-reusable-upload-id.util';

describe('getReusableUploadId', () => {
  const state = reviewState();

  it('reuses the upload for the same attachment and trimmed name', () => {
    expect(getReusableUploadId(state)).toBe('doc-1');
    expect(getReusableUploadId({ ...state, draft: { ...state.draft, name: ' Contract ' } })).toBe('doc-1');
  });

  it.each([
    ['no upload', { upload: null }],
    ['a renamed document', { draft: { ...state.draft, name: 'Renamed' } }],
    ['another attachment', { draft: { ...state.draft, attachmentId: 'other' } }],
    ['a template', { draft: { ...state.draft, sourceType: 'TEMPLATE' as const } }],
  ])('does not reuse it for %s', (_, overrides) => {
    expect(getReusableUploadId({ ...state, ...overrides })).toBeNull();
  });
});

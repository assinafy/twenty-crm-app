import { describe, expect, it } from 'vitest';

import { parseDocumentActionInput } from 'src/utils/parse-document-action-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const DOCUMENT_RECORD_ID = '3e0f6d5b-9c4a-4f1d-8b5e-8a7c6d4e5f60';

describe('parseDocumentActionInput', () => {
  it('returns the document record id', () => {
    expect(parseDocumentActionInput({ documentRecordId: DOCUMENT_RECORD_ID })).toEqual({
      documentRecordId: DOCUMENT_RECORD_ID,
    });
  });

  it.each([
    ['text', { field: 'body', reason: 'type' }],
    [{ documentRecordId: 'doc_1' }, { field: 'documentRecordId', reason: 'format' }],
    [{ documentRecordId: DOCUMENT_RECORD_ID, force: true }, { field: 'body.force', reason: 'unknown_key' }],
  ])('rejects %j', (body, details) => {
    expect(() => parseDocumentActionInput(body)).toThrow(invalid(details));
  });
});

import { describe, expect, it } from 'vitest';

import { parseDiscardInput } from 'src/utils/parse-discard-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

describe('parseDiscardInput', () => {
  it('returns the upload and its account', () => {
    expect(parseDiscardInput({ assinafyDocumentId: 'doc_1', accountId: 'acc_1' })).toEqual({
      assinafyDocumentId: 'doc_1',
      accountId: 'acc_1',
    });
  });

  it.each([
    [[], { field: 'body', reason: 'type' }],
    [{ accountId: 'acc_1' }, { field: 'assinafyDocumentId', reason: 'required' }],
    [{ assinafyDocumentId: 'doc 1', accountId: 'acc_1' }, { field: 'assinafyDocumentId', reason: 'format' }],
    [{ assinafyDocumentId: 'doc_1' }, { field: 'accountId', reason: 'required' }],
    [{ assinafyDocumentId: 'doc_1', accountId: 'a'.repeat(65) }, { field: 'accountId', reason: 'format' }],
    [{ assinafyDocumentId: 'doc_1', accountId: 'acc_1', recordId: 'x' }, { field: 'body.recordId', reason: 'unknown_key' }],
  ])('rejects %j', (body, details) => {
    expect(() => parseDiscardInput(body)).toThrow(invalid(details));
  });
});

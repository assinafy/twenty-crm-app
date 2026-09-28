import { describe, expect, it } from 'vitest';

import { parseResendInput } from 'src/utils/parse-resend-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const DOCUMENT_RECORD_ID = '3e0f6d5b-9c4a-4f1d-8b5e-8a7c6d4e5f60';

describe('parseResendInput', () => {
  it('reads a missing expected cost as an estimate request', () => {
    expect(parseResendInput({ documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig_1' })).toEqual({
      documentRecordId: DOCUMENT_RECORD_ID,
      signerId: 'sig_1',
      expectedTotalCredits: null,
    });
  });

  it('keeps a confirmed cost, including zero', () => {
    expect(
      parseResendInput({ documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig_1', expectedTotalCredits: 0 })
        .expectedTotalCredits,
    ).toBe(0);
    expect(
      parseResendInput({ documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig_1', expectedTotalCredits: 0.45 })
        .expectedTotalCredits,
    ).toBe(0.45);
  });

  it.each([
    [null, { field: 'body', reason: 'type' }],
    [{ documentRecordId: 'x', signerId: 'sig_1' }, { field: 'documentRecordId', reason: 'format' }],
    [{ documentRecordId: DOCUMENT_RECORD_ID }, { field: 'signerId', reason: 'required' }],
    [{ documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig/1' }, { field: 'signerId', reason: 'format' }],
    [
      { documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig_1', expectedTotalCredits: -0.45 },
      { field: 'expectedTotalCredits', reason: 'out_of_range' },
    ],
    [
      { documentRecordId: DOCUMENT_RECORD_ID, signerId: 'sig_1', email: 'x@example.invalid' },
      { field: 'body.email', reason: 'unknown_key' },
    ],
  ])('rejects %j', (body, details) => {
    expect(() => parseResendInput(body)).toThrow(invalid(details));
  });
});

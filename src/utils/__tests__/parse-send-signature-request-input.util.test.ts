import { describe, expect, it } from 'vitest';

import { parseSendSignatureRequestInput } from 'src/utils/parse-send-signature-request-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const now = new Date('2026-09-25T12:00:00.000Z');
const REQUEST_ID = '2d9e5c4a-8b3f-4e0c-9a4d-7f6b5c3d4e5f';

const body = (overrides: Record<string, unknown> = {}) => ({
  recordId: '0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d',
  source: { type: 'PDF', attachmentId: '1c8d4b3f-7a2e-4d9b-8f3c-6e5a4b2c3d4e' },
  name: 'Contract',
  signers: [{ name: 'Ana Test', email: 'ana@example.invalid', verificationMethod: 'Email' }],
  assinafyDocumentId: 'doc_1',
  requestId: REQUEST_ID,
  accountId: 'acc_1',
  expectedTotalCredits: 1.45,
  expectedDocuments: 1,
  ...overrides,
});

describe('parseSendSignatureRequestInput', () => {
  it('parses the request and the confirmed estimate', () => {
    expect(parseSendSignatureRequestInput(body(), now)).toEqual(
      expect.objectContaining({
        name: 'Contract',
        assinafyDocumentId: 'doc_1',
        requestId: REQUEST_ID,
        accountId: 'acc_1',
        expectedTotalCredits: 1.45,
        expectedDocuments: 1,
      }),
    );
  });

  it('accepts a zero-cost estimate', () => {
    expect(parseSendSignatureRequestInput(body({ expectedTotalCredits: 0, expectedDocuments: 0 }), now)).toEqual(
      expect.objectContaining({ expectedTotalCredits: 0, expectedDocuments: 0 }),
    );
  });

  it.each([
    ['close', '2026-09-25T12:30:00Z'],
    ['past', '2026-09-25T11:30:00Z'],
  ])('parses a deadline that is now %s, so a retry reaches the request id lookup', (_label, expiresAt) => {
    expect(parseSendSignatureRequestInput(body({ expiresAt }), now)).toEqual(
      expect.objectContaining({ requestId: REQUEST_ID, expiresAt: new Date(expiresAt).toISOString() }),
    );
  });

  it('still rejects a malformed deadline', () => {
    expect(() => parseSendSignatureRequestInput(body({ expiresAt: '2027-02-30T10:00:00Z' }), now)).toThrow(
      invalid({ field: 'expiresAt', reason: 'format' }),
    );
  });

  it('lowercases the request id', () => {
    expect(parseSendSignatureRequestInput(body({ requestId: REQUEST_ID.toUpperCase() }), now).requestId).toBe(
      REQUEST_ID,
    );
  });

  it.each([
    ['a non-object body', null, { field: 'body', reason: 'type' }],
    ['unknown keys', body({ extra: 1 }), { field: 'body.extra', reason: 'unknown_key' }],
    ['a non-uuid request id', body({ requestId: 'req-1' }), { field: 'requestId', reason: 'format' }],
    ['a missing request id', body({ requestId: undefined }), { field: 'requestId', reason: 'required' }],
    ['a malformed account id', body({ accountId: 'acc 1' }), { field: 'accountId', reason: 'format' }],
    ['a missing account id', body({ accountId: '' }), { field: 'accountId', reason: 'required' }],
    [
      'negative credits',
      body({ expectedTotalCredits: -1 }),
      { field: 'expectedTotalCredits', reason: 'out_of_range' },
    ],
    [
      'non-finite credits',
      body({ expectedTotalCredits: Number.POSITIVE_INFINITY }),
      { field: 'expectedTotalCredits', reason: 'type' },
    ],
    ['missing credits', body({ expectedTotalCredits: undefined }), { field: 'expectedTotalCredits', reason: 'required' }],
    ['missing documents', body({ expectedDocuments: undefined }), { field: 'expectedDocuments', reason: 'required' }],
    ['fractional documents', body({ expectedDocuments: 0.5 }), { field: 'expectedDocuments', reason: 'type' }],
    ['negative documents', body({ expectedDocuments: -1 }), { field: 'expectedDocuments', reason: 'out_of_range' }],
    ['an invalid base request', body({ name: '' }), { field: 'name', reason: 'required' }],
  ])('rejects %s', (_label, raw, details) => {
    expect(() => parseSendSignatureRequestInput(raw, now)).toThrow(invalid(details));
  });
});

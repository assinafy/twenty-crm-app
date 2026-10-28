import { describe, expect, it } from 'vitest';

import { CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { parseContractInput } from 'src/utils/parse-contract-input.util';

const documentRecordId = buildDocumentRecord().id;
const get = { documentRecordId, action: 'get' };
const set = { documentRecordId, action: 'set', updatedAt: CONTRACT_UPDATED_AT, terms: CONTRACT_TERMS };

describe('parseContractInput', () => {
  it.each([
    get, set, { ...set, updatedAt: null },
    { documentRecordId, action: 'renew', updatedAt: CONTRACT_UPDATED_AT, term: 2 },
    { documentRecordId, action: 'terminate', updatedAt: CONTRACT_UPDATED_AT, reason: 'Encerrado por acordo.' },
  ])('parses an explicitly scoped contract action %j', (input) => {
    expect(parseContractInput(input)).toEqual(input);
  });

  it.each([
    null, [], { ...get, action: 'delete' }, { ...get, documentRecordId: 'provider-id' },
    { ...get, accountId: 'another-account' }, { ...get, updatedAt: null },
    { ...set, updatedAt: '2026-10-28' }, { ...set, updatedAt: '2026-99-28T12:00:00Z' },
    { ...set, terms: { ...CONTRACT_TERMS, owner_id: 'someone-else' } },
    { ...get, action: 'renew', updatedAt: CONTRACT_UPDATED_AT, term: 0 },
    { ...get, action: 'renew', updatedAt: null, term: 1 },
    { ...get, action: 'terminate', updatedAt: CONTRACT_UPDATED_AT, reason: 'x'.repeat(501) },
  ])('rejects untrusted or incomplete input %j', (input) => {
    expect(() => parseContractInput(input)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});

import { describe, expect, it } from 'vitest';

import { contract } from 'src/front-components/utils/__tests__/contract-fixtures';
import { getContractActions } from 'src/front-components/utils/get-contract-actions.util';

describe('getContractActions', () => {
  it('creates tracking on a document without terms', () => {
    expect(getContractActions(null)).toEqual({ edit: true, renew: false, terminate: false });
  });

  it.each([
    ['draft', true, false, true],
    ['active', true, true, true],
    ['expired', false, true, true],
    ['terminated', false, false, false],
  ] as const)('offers only the legal root actions for %s', (status, edit, renew, terminate) => {
    expect(getContractActions(contract({ status }))).toEqual({ edit, renew, terminate });
  });

  it('does not renew a contract without an end date', () => {
    expect(getContractActions(contract({ end_date: null })).renew).toBe(false);
  });

  it('keeps amendment instruments read-only', () => {
    expect(getContractActions({ kind: 'amendment', status: 'pending', relationType: 'amendment', appliedAt: null, updatedAt: '2026-10-28T12:00:00Z' })).toEqual({ edit: false, renew: false, terminate: false });
  });
});

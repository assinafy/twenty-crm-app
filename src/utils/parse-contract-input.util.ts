import { type ContractInput } from 'src/types/contract-input';
import { expectObject } from 'src/utils/expect-object.util';
import { parseContractTerms } from 'src/utils/parse-contract-terms.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';

export const parseContractInput = (body: unknown): ContractInput => {
  const raw = expectObject(body, 'body');
  const action = readEnum(raw.action, 'action', ['get', 'set', 'renew', 'terminate'], { required: true });
  const extra = action === 'get' ? [] : ['updatedAt', action === 'set' ? 'terms' : action === 'renew' ? 'term' : 'reason'];
  const input = expectObject(raw, 'body', ['documentRecordId', 'action', ...extra]);
  const documentRecordId = readUuid(input.documentRecordId, 'documentRecordId');
  if (action === 'get') return { documentRecordId, action };
  const revisionOptions = {
    max: 40,
    test: (date: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(date) && Number.isFinite(Date.parse(date)),
  };
  if (action === 'set') {
    return { documentRecordId, action, updatedAt: readString(input.updatedAt, 'updatedAt', revisionOptions), terms: parseContractTerms(input.terms) };
  }
  const updatedAt = readString(input.updatedAt, 'updatedAt', { ...revisionOptions, required: true });
  if (action === 'renew') {
    return { documentRecordId, action, updatedAt, term: readNumber(input.term, 'term', { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, required: true }) };
  }
  return { documentRecordId, action, updatedAt, reason: readString(input.reason, 'reason', { max: 500 }) };
};

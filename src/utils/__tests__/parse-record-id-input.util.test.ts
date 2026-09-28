import { describe, expect, it } from 'vitest';

import { parseRecordIdInput } from 'src/utils/parse-record-id-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const RECORD_ID = '0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d';

describe('parseRecordIdInput', () => {
  it('returns the record id', () => {
    expect(parseRecordIdInput({ recordId: RECORD_ID })).toEqual({ recordId: RECORD_ID });
  });

  it.each([
    [undefined, { field: 'body', reason: 'type' }],
    [{}, { field: 'recordId', reason: 'required' }],
    [{ recordId: 'person:1' }, { field: 'recordId', reason: 'format' }],
    [{ recordId: RECORD_ID, objectNameSingular: 'person' }, { field: 'body.objectNameSingular', reason: 'unknown_key' }],
  ])('rejects %j', (body, details) => {
    expect(() => parseRecordIdInput(body)).toThrow(invalid(details));
  });
});

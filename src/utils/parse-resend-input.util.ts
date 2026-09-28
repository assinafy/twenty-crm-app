import { type ResendInput } from 'src/types/resend-input';
import { expectObject } from 'src/utils/expect-object.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';

// Without expectedTotalCredits the handler only estimates; with it, the resend is confirmed at that cost.
export const parseResendInput = (body: unknown): ResendInput => {
  const input = expectObject(body, 'body', ['documentRecordId', 'signerId', 'expectedTotalCredits']);

  return {
    documentRecordId: readUuid(input.documentRecordId, 'documentRecordId'),
    signerId: readString(input.signerId, 'signerId', { test: isAssinafyId, required: true }),
    expectedTotalCredits: readNumber(input.expectedTotalCredits, 'expectedTotalCredits', { min: 0 }),
  };
};

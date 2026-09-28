import { type SendSignatureRequestInput } from 'src/types/send-signature-request-input';
import { expectObject } from 'src/utils/expect-object.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { parseSignatureRequestInput } from 'src/utils/parse-signature-request-input.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';

// The reviewed request plus what the user confirmed: the idempotency key and the estimate they accepted. The deadline
// lead time is not checked here: a retry of a send whose answer was lost must reach the requestId lookup even when the
// deadline is now close or past, and the send service checks it after that lookup, before any claim.
export const parseSendSignatureRequestInput = (body: unknown, now: Date): SendSignatureRequestInput => {
  const { requestId, accountId, expectedTotalCredits, expectedDocuments, ...request } = expectObject(body, 'body');

  return {
    ...parseSignatureRequestInput(request, now, null),
    requestId: readUuid(requestId, 'requestId'),
    accountId: readString(accountId, 'accountId', { test: isAssinafyId, required: true }),
    expectedTotalCredits: readNumber(expectedTotalCredits, 'expectedTotalCredits', { min: 0, required: true }),
    expectedDocuments: readNumber(expectedDocuments, 'expectedDocuments', { min: 0, integer: true, required: true }),
  };
};

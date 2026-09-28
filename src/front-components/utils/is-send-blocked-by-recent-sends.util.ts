import { type SignatureContext } from 'src/types/signature-context';

// A document sent from the record shortly before may be the outcome of a send whose answer was lost: a new send
// waits until the member says they checked it.
export const isSendBlockedByRecentSends = (context: Pick<SignatureContext, 'recentSends'>, acknowledged: boolean) =>
  context.recentSends.length > 0 && !acknowledged;

import { type SignatureRequestInput } from 'src/types/signature-request-input';

export type SendSignatureRequestInput = SignatureRequestInput & {
  requestId: string;
  accountId: string;
  expectedTotalCredits: number;
  expectedDocuments: number;
  // Epoch milliseconds after which the run may be killed (workflow): no billable call starts that could outlive it.
  deadlineMs?: number;
};

// Validated body of /assinafy/documents/resend: without expectedTotalCredits it only quotes the resend.
export type ResendInput = {
  documentRecordId: string;
  signerId: string;
  expectedTotalCredits: number | null;
};

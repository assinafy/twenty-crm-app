// Normalized Assinafy estimate (assignment, template or resend).
export type CostEstimate = {
  documents: number;
  totalCredits: number;
  creditBalance: number | null;
  documentBalance: number | null;
  needsExtraDocument: boolean;
  extraDocumentCost: number;
  sufficient: boolean;
  blockingReason: 'PendingPayment' | 'InsufficientDocuments' | 'InsufficientCredits' | null;
};

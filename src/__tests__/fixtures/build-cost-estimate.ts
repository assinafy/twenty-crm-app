import { type CostEstimate } from 'src/types/cost-estimate';

// An affordable estimate: one WhatsApp notification, no plan document.
export const buildCostEstimate = (overrides: Partial<CostEstimate> = {}): CostEstimate => ({
  documents: 0,
  totalCredits: 0.45,
  creditBalance: 10,
  documentBalance: null,
  needsExtraDocument: false,
  extraDocumentCost: 0,
  sufficient: true,
  blockingReason: null,
  ...overrides,
});

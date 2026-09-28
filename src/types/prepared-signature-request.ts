import { type CostEstimate } from 'src/types/cost-estimate';

export type PreparedSignatureRequest = {
  accountId: string;
  accountName: string;
  assinafyDocumentId: string | null;
  estimate: CostEstimate;
};

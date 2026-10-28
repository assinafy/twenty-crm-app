import { type ContractTerms } from 'src/types/contract-terms';

export type ContractInput = { documentRecordId: string } & (
  | { action: 'get' }
  | { action: 'set'; updatedAt: string | null; terms: ContractTerms }
  | { action: 'renew'; updatedAt: string; term: number }
  | { action: 'terminate'; updatedAt: string; reason: string | null }
);

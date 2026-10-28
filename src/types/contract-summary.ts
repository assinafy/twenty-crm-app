import { type ContractTerms } from 'src/types/contract-terms';

export type ContractSummary =
  | (Omit<ContractTerms, 'status'> & {
      kind: 'contract';
      status: 'draft' | 'active' | 'expired' | 'terminated';
      term: number;
      updatedAt: string;
    })
  | {
      kind: 'amendment';
      status: 'pending' | 'applied';
      relationType: 'amendment' | 'renewal' | 'termination';
      appliedAt: string | null;
      updatedAt: string;
    };

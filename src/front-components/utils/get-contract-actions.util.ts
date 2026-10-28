import { type ContractSummary } from 'src/types/contract-summary';

export const getContractActions = (contract: ContractSummary | null): {
  edit: boolean;
  renew: boolean;
  terminate: boolean;
} => ({
  edit: contract === null || (contract.kind === 'contract' && (contract.status === 'draft' || contract.status === 'active')),
  renew: contract?.kind === 'contract' && (contract.status === 'active' || contract.status === 'expired') && contract.end_date !== null,
  terminate: contract?.kind === 'contract' && contract.status !== 'terminated',
});

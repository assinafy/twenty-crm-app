import { type AppError } from 'src/types/app-error';
import { type ContractSummary } from 'src/types/contract-summary';

export type ContractPanelState = {
  contract: ContractSummary | null;
  loaded: boolean;
  busy: boolean;
  refreshRequired: boolean;
  revision: number;
  error: AppError | null;
};

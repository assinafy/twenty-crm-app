import { type AppResult } from 'src/types/app-result';
import { type ContractPanelState } from 'src/types/contract-panel-state';
import { type ContractSummary } from 'src/types/contract-summary';

type Action =
  | { type: 'START' }
  | { type: 'SETTLE'; mutation: boolean; result: AppResult<{ contract: ContractSummary | null }> };

export const contractPanelReducer = (state: ContractPanelState, action: Action): ContractPanelState => {
  if (action.type === 'START') return { ...state, busy: true, error: null };
  if (action.result.ok) {
    return {
      contract: action.result.contract,
      loaded: true,
      busy: false,
      refreshRequired: false,
      revision: state.revision + 1,
      error: null,
    };
  }
  const { error } = action.result;
  return {
    ...state,
    busy: false,
    error,
    refreshRequired: state.refreshRequired || (
      action.mutation && ['CONTRACT_CHANGED', 'CONTRACT_UNCERTAIN', 'INTERNAL'].includes(error.code)
    ),
  };
};

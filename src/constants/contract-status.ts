import { type ThemeColor } from 'twenty-ui/theme';

import { type ContractStatus } from 'src/types/contract-status';

export const CONTRACT_STATUS_OPTIONS: Array<{ value: ContractStatus; label: string; color: ThemeColor; position: number }> = [
  { value: 'DRAFT', label: 'Rascunho', color: 'gray', position: 0 },
  { value: 'ACTIVE', label: 'Vigente', color: 'green', position: 1 },
  { value: 'EXPIRED', label: 'Vencido', color: 'orange', position: 2 },
  { value: 'TERMINATED', label: 'Encerrado', color: 'red', position: 3 },
  { value: 'AMENDMENT_PENDING', label: 'Aditivo pendente', color: 'amber', position: 4 },
  { value: 'AMENDMENT_APPLIED', label: 'Aditivo aplicado', color: 'blue', position: 5 },
];

import { ApiError, type AssinafyClient } from '@assinafy/sdk';

import { type ContractSummary } from 'src/types/contract-summary';
import { toContractSummary } from 'src/utils/to-contract-summary.util';

export const readAssinafyContract = async (client: AssinafyClient, documentId: string): Promise<ContractSummary | null> => {
  try {
    return toContractSummary(await client.contracts.get(documentId), documentId);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    throw error;
  }
};

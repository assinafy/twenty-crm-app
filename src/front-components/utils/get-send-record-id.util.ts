import { type SendFlowState } from 'src/types/send-flow-state';

// The assinafyDocument record a finished or uncertain send left: the answer's summary, or the record an UNCERTAIN
// failure names in its details (kept for reconciliation).
export const getSendRecordId = ({ result, error }: Pick<SendFlowState, 'result' | 'error'>): string | null => {
  const detail = error?.details?.documentRecordId;

  return result?.documentRecordId ?? (typeof detail === 'string' ? detail : null);
};

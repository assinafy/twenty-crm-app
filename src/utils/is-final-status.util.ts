import { FINAL_DOCUMENT_STATUSES } from 'src/constants/document-status';

export const isFinalStatus = (status: string | null): boolean =>
  status !== null && FINAL_DOCUMENT_STATUSES.includes(status);

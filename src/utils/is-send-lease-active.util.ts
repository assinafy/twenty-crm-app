import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { isWithinSendLease } from 'src/utils/is-within-send-lease.util';

export const isSendLeaseActive = (record: Pick<AssinafyDocumentRecord, 'status' | 'updatedAt'>, now: Date): boolean =>
  record.status === DOCUMENT_STATUS.SENDING && isWithinSendLease(record.updatedAt, now);

import { PANEL_STALE_AFTER_MS } from 'src/constants/limits';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { isFinalStatus } from 'src/utils/is-final-status.util';

// Whether opening the panel should refresh the document. Without an Assinafy document there is nothing to read,
// except for a send whose lease may have run out. A document background sync cannot reach is refreshed on every open,
// with the member's own connection, however recent its last check.
export const isPanelStale = (
  record: Pick<AssinafyDocumentRecord, 'status' | 'lastSyncedAt' | 'assinafyDocumentId' | 'lastError'>,
  now: Date,
): boolean => {
  if (isFinalStatus(record.status)) {
    return false;
  }

  if (record.assinafyDocumentId === null && record.status !== 'SENDING') {
    return false;
  }

  if (record.lastError === 'NO_CREDENTIAL') {
    return true;
  }

  const syncedAt = record.lastSyncedAt === null ? Number.NaN : Date.parse(record.lastSyncedAt);

  return !(now.getTime() - syncedAt <= PANEL_STALE_AFTER_MS);
};

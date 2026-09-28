import { type CoreApiClient } from 'twenty-client-sdk/core';

import { isPermissionDenied } from 'src/data/is-permission-denied';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { AppFailure } from 'src/utils/app-failure.util';

// Actions that change a document in Assinafy (cancel, resend) write as the app afterwards, so a no-op write as the
// member comes first: Twenty then enforces the member's update permission on the record before anything is changed.
// lastSyncedAt is written back unchanged and is not audit-logged.
export const assertCanUpdateAssinafyDocument = async (
  core: CoreApiClient,
  record: Pick<AssinafyDocumentRecord, 'id' | 'lastSyncedAt'>,
): Promise<void> => {
  try {
    await updateAssinafyDocument(core, record.id, { lastSyncedAt: record.lastSyncedAt });
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new AppFailure('FORBIDDEN', 'Sua função no Twenty não permite alterar este documento.', {
        reason: 'member_permission',
      });
    }
    throw error;
  }
};

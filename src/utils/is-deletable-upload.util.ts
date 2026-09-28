import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { isUnsentDocument } from 'src/utils/is-unsent-document.util';
import { mapAssinafyStatus } from 'src/utils/map-assinafy-status.util';

// An upload of this Assinafy workspace the discard route and the purge may delete: an unsent draft, or an upload whose
// Assinafy processing failed before anyone requested signatures. A failed upload is still never reused or sent
// (isUnsentDocument).
export const isDeletableUpload = (
  details: Pick<IDocumentDetailsResponse, 'account_id' | 'status' | 'assignment'>,
  accountId: string,
): boolean =>
  details.account_id === accountId &&
  (isUnsentDocument(details) ||
    (!details.assignment && mapAssinafyStatus(details.status, { sent: false }) === DOCUMENT_STATUS.FAILED));

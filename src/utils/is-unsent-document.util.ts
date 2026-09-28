import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { mapAssinafyStatus } from 'src/utils/map-assinafy-status.util';

// An upload nobody requested signatures on: no assignment and still a draft status (which maps to UNCERTAIN when
// unsent, so the draft list lives in one place).
export const isUnsentDocument = (details: Pick<IDocumentDetailsResponse, 'status' | 'assignment'>): boolean =>
  !details.assignment && mapAssinafyStatus(details.status, { sent: false }) === DOCUMENT_STATUS.UNCERTAIN;

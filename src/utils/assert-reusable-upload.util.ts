import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { AppFailure } from 'src/utils/app-failure.util';
import { isUnsentDocument } from 'src/utils/is-unsent-document.util';

// A PDF upload is estimated again or sent only while it is still an unsent draft of the same Assinafy workspace.
export const assertReusableUpload = (
  details: Pick<IDocumentDetailsResponse, 'account_id' | 'status' | 'assignment'>,
  accountId: string,
): void => {
  if (details.account_id !== accountId || !isUnsentDocument(details)) {
    throw new AppFailure('INVALID_STATE', 'O PDF carregado na Assinafy mudou. Revise a solicitação novamente.');
  }
};

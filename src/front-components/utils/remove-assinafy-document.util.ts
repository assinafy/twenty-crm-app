import { type CoreApiClient } from 'twenty-client-sdk/core';

import { isPermissionDenied } from 'src/data/is-permission-denied';
import { type AppError } from 'src/types/app-error';
import { errorName } from 'src/utils/error-name.util';

// Native soft delete; resolves the error to show, or null once removed. A role without delete permission is the
// member's own restriction, not a failure worth retrying.
export const removeAssinafyDocument = async (core: Pick<CoreApiClient, 'mutation'>, id: string): Promise<AppError | null> => {
  try {
    await core.mutation({ deleteAssinafyDocument: { __args: { id }, id: true } });

    return null;
  } catch (error) {
    console.error('[assinafy] removing the document failed', { name: errorName(error) });

    return isPermissionDenied(error)
      ? { code: 'FORBIDDEN', message: '', details: { reason: 'member_permission' } }
      : { code: 'INTERNAL', message: '' };
  }
};

import { type AppConnection, type ListConnectionsFilter, listConnections } from 'twenty-sdk/logic-function';

import { ASSINAFY_CONNECTION_PROVIDER_NAME } from 'src/constants/assinafy';
import { AppFailure } from 'src/utils/app-failure.util';
import { errorName } from 'src/utils/error-name.util';

// Callers must not fall back to the API key when this fails: that would silently switch the acting identity.
export const listAssinafyConnections = async (
  filter: Omit<ListConnectionsFilter, 'providerName'>,
): Promise<AppConnection[]> => {
  try {
    const listed = await listConnections({ providerName: ASSINAFY_CONNECTION_PROVIDER_NAME, ...filter });
    // Twenty lists without an order and every token refresh rewrites the row, so sort by name ("Assinafy #1" before
    // "Assinafy #2") and id: the order decides which credential is used first.
    return listed.toSorted((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }) || a.id.localeCompare(b.id));
  } catch (error) {
    console.error('[assinafy] listConnections failed', { name: errorName(error) });
    throw new AppFailure(
      'PROVIDER_UNAVAILABLE',
      'Não foi possível carregar as conexões com a Assinafy. Tente novamente em instantes.',
      { provider: 'twenty' },
    );
  }
};

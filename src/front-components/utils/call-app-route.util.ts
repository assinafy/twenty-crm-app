import { RestApiClient } from 'twenty-client-sdk/rest';

import { NO_ENVELOPE_MESSAGE } from 'src/constants/app-route';
import { type AppResult } from 'src/types/app-result';
import { errorName } from 'src/utils/error-name.util';

const isEnvelope = (body: unknown): body is AppResult<object> =>
  typeof body === 'object' && body !== null && typeof (body as { ok?: unknown }).ok === 'boolean';

// App routes always answer 200 with an envelope; anything else (network, runtime timeout, proxy page) is an unknown
// outcome reported as INTERNAL, which the send flow treats as retryable with the same request id.
export const callAppRoute = async <TData extends object>(
  path: `/s/assinafy/${string}`,
  body: object,
  client: Pick<RestApiClient, 'post'> = new RestApiClient(),
): Promise<AppResult<TData>> => {
  try {
    const response = await client.post<unknown>(path, body);

    if (isEnvelope(response)) {
      return response as AppResult<TData>;
    }
  } catch (error) {
    console.error('[assinafy] route call failed', { path, name: errorName(error) });
  }

  return { ok: false, error: { code: 'INTERNAL', message: NO_ENVELOPE_MESSAGE } };
};

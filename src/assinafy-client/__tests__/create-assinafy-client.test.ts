import { describe, expect, it } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { ASSINAFY_API_BASE_URL } from 'src/constants/assinafy';

describe('createAssinafyClient', () => {
  it('targets the production Assinafy API', () => {
    const client = createAssinafyClient({ kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: null });

    expect(client.getAxiosInstance().defaults.baseURL).toBe(ASSINAFY_API_BASE_URL);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { HEALTH_CHECK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import healthCheck from 'src/logic-functions/health-check.logic-function';
import { healthCheckHandler } from 'src/logic-functions/handlers/health-check.handler';

vi.mock('src/logic-functions/handlers/health-check.handler', () => ({ healthCheckHandler: vi.fn<typeof healthCheckHandler>() }));

const handler = vi.mocked(healthCheckHandler);

describe('health-check', () => {
  it('is the app health check with a short timeout', () => {
    expect(healthCheck.success).toBe(true);
    expect(healthCheck.config).toMatchObject({ universalIdentifier: HEALTH_CHECK_UNIVERSAL_IDENTIFIER, timeoutSeconds: 20 });
  });

  it('checks with the production Assinafy client factory', async () => {
    handler.mockResolvedValue({ status: 'OK' });

    await expect(healthCheck.config.handler()).resolves.toEqual({ status: 'OK' });
    expect(handler).toHaveBeenCalledWith(createAssinafyClient);
  });
});

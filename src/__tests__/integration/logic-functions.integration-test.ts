import { beforeAll, describe, expect, it } from 'vitest';

import {
  executeLogicFunction,
  findInstalledApp,
  HAS_WORKSPACE_API_KEY,
  WORKSPACE_API_KEY,
  type InstalledApp,
  metadataClient,
} from 'src/__tests__/integration/twenty-api';
import {
  HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
  ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
  SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER,
  UNINSTALL_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

let app: InstalledApp;

beforeAll(async () => {
  app = await findInstalledApp();
});

// Runs on the fresh install of the global setup: no API key, no connection, no OAuth client. executeLogicFunction runs
// as the signed-in member, so the lifecycle hooks ignore the run (only Twenty itself may make them revoke grants).
describe('background logic functions without an Assinafy credential', () => {
  it('the health check warns that Assinafy is not connected', async () => {
    expect(await executeLogicFunction(app, HEALTH_CHECK_UNIVERSAL_IDENTIFIER)).toMatchObject({
      status: 'SUCCESS',
      data: { status: 'WARNING', title: 'A Assinafy não está conectada ao workspace', action: { label: 'Definir chave de API' } },
    });
  });

  it('the sync cron finds nothing to do', async () => {
    expect(await executeLogicFunction(app, SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER)).toMatchObject({
      status: 'SUCCESS',
      data: { found: 0, synced: 0, failed: 0, skipped: 0, purged: 0 },
    });
  });

  it('the uninstall hook ignores a member-triggered run', async () => {
    const result = await executeLogicFunction(app, UNINSTALL_UNIVERSAL_IDENTIFIER);

    expect(result).toMatchObject({ status: 'SUCCESS', error: null });
    expect(result.logs).toContain('uninstall: member-triggered run ignored');
  });

  it('the disconnect hook ignores a member-triggered run', async () => {
    const result = await executeLogicFunction(app, ON_DISCONNECT_UNIVERSAL_IDENTIFIER, {
      connectionProviderId: 'x',
      connectionProviderName: 'assinafy',
      connectedAccountId: crypto.randomUUID(),
    });

    expect(result).toMatchObject({ status: 'SUCCESS', error: null });
    expect(result.logs).toContain('on-assinafy-disconnect: member-triggered run ignored');
  });
});

it.skipIf(!HAS_WORKSPACE_API_KEY)('the workspace API key cannot execute logic functions', async () => {
  const logicFunction = app.logicFunctions.find(
    (candidate) => candidate.universalIdentifier === HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
  );

  await expect(
    metadataClient(WORKSPACE_API_KEY).mutation({
      executeOneLogicFunction: { __args: { input: { id: logicFunction!.id, payload: {} } }, status: true },
    }),
  ).rejects.toThrow(/requires a token bound to a user workspace/);
});

import { beforeAll, describe, expect, inject, it } from 'vitest';

import { appRows } from 'src/__tests__/e2e/app-rows';
import { pdfRequest, prepare } from 'src/__tests__/e2e/e2e-flows';
import {
  connectAssinafy,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  listConnectedAccounts,
  useSimulatorApiKey,
} from 'src/__tests__/e2e/e2e-twenty';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { psql } from 'src/__tests__/e2e/psql';
import { listRegistrationVariables, setRegistrationVariable } from 'src/__tests__/e2e/registration-variables';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { uninstallApp } from 'src/__tests__/e2e/uninstall-app';
import { createCrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { runCleanup } from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_CLIENT_ID_VARIABLE, ASSINAFY_CLIENT_SECRET_VARIABLE } from 'src/constants/assinafy';
import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
const grants: string[] = [];

beforeAll(async () => {
  app = await findE2eApp();
  await setRegistrationVariable(ASSINAFY_CLIENT_ID_VARIABLE, inject('simClientId'));
  await setRegistrationVariable(ASSINAFY_CLIENT_SECRET_VARIABLE, inject('simClientSecret'));
});

describe('uninstall', () => {
  it('prepares live connections (personal, shared and one flagged) and app key-value data', async () => {
    for (const visibility of ['user', 'workspace', 'user'] as const) {
      const mark = await simulator.mark();
      await connectAssinafy(app, visibility);
      const exchange = (await simulator.logSince(mark)).find(({ grantType }) => grantType === 'authorization_code');
      grants.push(exchange?.grantId ?? '');
    }
    const accounts = await listConnectedAccounts(app);
    expect(accounts).toHaveLength(3);
    // A connection the app flagged (e.g. for a missing scope) still holds a live grant.
    await psql(`update core."connectedAccount" set "authFailedAt" = now(), "authFailedReason" = 'E2E' where id = '${accounts[2]?.id}'`);

    await useSimulatorApiKey(app);
    const crm = await createCrmFixtures(cleanup);
    await prepare(await frontEndToken(app), pdfRequest(crm, 'Pendente na desinstalação E2E'));
    await runCleanup(cleanup);
    expect((await appRows(app.id, 'keyValuePair', 'key')).length).toBeGreaterThan(0);
  });

  it('the uninstall hook revokes every grant once, and the app, its data and its connections are gone', async () => {
    const mark = await simulator.mark();

    await uninstallApp();

    await poll(
      () =>
        graphql('metadata', 'query ($id: UUID!) { findOneApplication(universalIdentifier: $id) { id } }', {
          id: APPLICATION_UNIVERSAL_IDENTIFIER,
        }).then(
          () => 'installed',
          () => 'gone',
        ),
      (state) => state === 'gone',
      { timeoutMs: 60_000, label: 'the app to be uninstalled' },
    );
    const log = await simulator.logSince(mark);
    const revokes = log.filter(({ kind }) => kind === 'revoke');
    expect(revokes.map(({ grantId }) => grantId).toSorted()).toEqual(grants.toSorted());
    expect(revokes.every(({ status, tokenTypeHint }) => status === 200 && tokenTypeHint === 'access_token')).toBe(true);
    // Each connection is resolved once: no refresh and no second read.
    expect(log.filter(({ kind }) => kind === 'token')).toEqual([]);
    const simulatorGrants = await simulator.grants();
    expect(grants.map((id) => simulatorGrants.find((grant) => grant.id === id)?.revoked)).toEqual([true, true, true]);

    const objects = await psql(
      `select id from core."objectMetadata" where "universalIdentifier" = '${ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER}'`,
    );
    expect(objects).toEqual([]);
    for (const table of ['fieldMetadata', 'logicFunction', 'frontComponent', 'commandMenuItem', 'pageLayoutTab', 'keyValuePair', 'connectedAccount', 'connectionProvider']) {
      expect({ table, rows: (await appRows(app.id, table, 'id')).length }).toEqual({ table, rows: 0 });
    }
  });

  it('the registration keeps its server variables, which are then reset', async () => {
    const filled = (await listRegistrationVariables()).filter(({ isFilled }) => isFilled).map(({ key }) => key);
    expect(filled.toSorted()).toEqual([ASSINAFY_CLIENT_ID_VARIABLE, ASSINAFY_CLIENT_SECRET_VARIABLE].toSorted());

    await setRegistrationVariable(ASSINAFY_CLIENT_ID_VARIABLE, null);
    await setRegistrationVariable(ASSINAFY_CLIENT_SECRET_VARIABLE, null);
    expect((await listRegistrationVariables()).filter(({ isFilled }) => isFilled)).toEqual([]);
  });
});

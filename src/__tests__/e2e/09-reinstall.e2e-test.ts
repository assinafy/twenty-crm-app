import { describe, expect, inject, it } from 'vitest';

import { findE2eApp, frontEndToken, listConnectedAccounts, runHealthCheck, useSimulatorApiKey } from 'src/__tests__/e2e/e2e-twenty';
import { syncApp } from 'src/__tests__/e2e/simulation-build';
import { createCrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup } from 'src/__tests__/integration/twenty-api';
import { type SignatureContext } from 'src/types/signature-context';

describe('reinstall', () => {
  it('installs a clean, working app again', async () => {
    await syncApp(inject('e2eAppCopyPath'));
    const app = await findE2eApp();

    expect(await listConnectedAccounts(app)).toEqual([]);
    expect(await runHealthCheck(app)).toMatchObject({ status: 'WARNING', title: 'A Assinafy não está conectada ao workspace' });

    await useSimulatorApiKey(app);
    expect(await runHealthCheck(app)).toMatchObject({ status: 'OK' });

    const cleanup: Array<() => Promise<unknown>> = [];
    try {
      const crm = await createCrmFixtures(cleanup);
      expect(
        await callRoute<SignatureContext>('/s/assinafy/context', await frontEndToken(app), { recordId: crm.person.id }),
      ).toMatchObject({ ok: true, sendingAs: { kind: 'apiKey' }, attachments: [{ id: crm.pdfAttachment.id }] });
    } finally {
      await runCleanup(cleanup);
    }
  });
});

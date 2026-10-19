import { DIGITAL_CERTIFICATE_REQUIRES_VIRTUAL_METHOD, ValidationError } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { createAssinafyClientFactory } from 'src/assinafy-client/create-assinafy-client-factory';
import { costEstimate } from 'src/services/__tests__/service-fixtures';
import { upsertSigners } from 'src/services/upsert-signers.service';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type NotificationMethod } from 'src/types/notification-method';
import { type VerificationMethod } from 'src/types/verification-method';
import { buildAssignmentSigners } from 'src/utils/build-assignment-signers.util';
import { buildEstimateSigners } from 'src/utils/build-estimate-signers.util';
import { buildTemplateSigners } from 'src/utils/build-template-signers.util';
import { validateSigners } from 'src/utils/validate-signers.util';

const PAIRINGS: Array<[VerificationMethod, NotificationMethod]> = [
  ['Email', 'Email'],
  ['Whatsapp', 'Whatsapp'],
  ['DigitalCertificate', 'Email'],
  ['DigitalCertificate', 'Whatsapp'],
  ['IdDocumentFaceMatchBasic', 'Email'],
  ['IdDocumentFaceMatchBasic', 'Whatsapp'],
];
const CREDENTIALS: AssinafyCredential[] = [
  { kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: 'account-1' },
  { kind: 'shared', connectionId: 'connection-1', accessToken: LEAK_SENTINELS[0], scopes: [] },
];

// Exercise the installed SDK transport and validation, rather than substituting resource-method mocks.
describe.each(CREDENTIALS)('signing contract with $kind', (credential) => {
  it.each(PAIRINGS)('%s verification with %s notification follows the PDF and template contract', async (verificationMethod, notificationMethod) => {
    const client = createAssinafyClientFactory('https://api.test.invalid/v1')(credential, { accountId: 'account-1' });
    const requests: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
    client.getAxiosInstance().defaults.adapter = async (config) => {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : {};
      const url = config.url ?? '';
      requests.push({ method: config.method ?? '', url, body });
      const data = url.endsWith('/estimate-cost') ? costEstimate()
        : url.endsWith('/assignments') ? { id: 'assignment-1', signers: [] }
        : url.endsWith('/documents') ? { id: 'document-2' }
        : config.method === 'get' ? []
        : { id: 'signer-1', full_name: 'Ana Exemplo', ...body };
      return { data: { status: 200, message: '', data }, status: 200, statusText: 'OK', headers: {}, config };
    };
    const signers = validateSigners([{
      name: 'Ana Exemplo', email: 'ana@example.invalid', phone: '+5511900000000', governmentId: '529.982.247-25',
      verificationMethod, notificationMethod, roleId: 'role-1',
    }], { source: 'TEMPLATE' });
    const upserted = await upsertSigners(client, signers);
    const [descriptor] = buildEstimateSigners(signers);
    const { role_id: _role, ...channel } = descriptor!;

    await client.assignments.estimateCost('document-1', { method: 'virtual', signers: [channel] });
    await client.assignments.create('document-1', { method: 'virtual', signers: buildAssignmentSigners(upserted, false) });
    const templateResults = [
      await client.documents.estimateCostFromTemplate('template-1', [{ ...channel, role_id: 'role-1' }])
        .then(() => null, (error: unknown) => error),
      await client.documents.createFromTemplate('template-1', buildTemplateSigners(upserted, false), { name: 'Contrato' })
        .then(() => null, (error: unknown) => error),
    ];
    expect(templateResults.map((error) => error instanceof ValidationError ? error.errors.code : error)).toEqual(
      verificationMethod === 'DigitalCertificate'
        ? [DIGITAL_CERTIFICATE_REQUIRES_VIRTUAL_METHOD, DIGITAL_CERTIFICATE_REQUIRES_VIRTUAL_METHOD]
        : [null, null],
    );

    const channelPayload = { verification_method: verificationMethod, notification_methods: [notificationMethod] };
    expect(requests.filter(({ url }) => url.endsWith('/estimate-cost')).map(({ body }) => body.signers)).toEqual([
      [channelPayload], ...(verificationMethod === 'DigitalCertificate' ? [] : [[{ role_id: 'role-1', ...channelPayload }]]),
    ]);
    const ordered = verificationMethod === 'DigitalCertificate' ? { step: 1 } : {};
    expect(requests.find(({ url }) => url === '/documents/document-1/assignments')?.body).toEqual({
      method: 'virtual', signers: [{ id: 'signer-1', ...channelPayload, ...ordered }],
    });
    expect(requests.find(({ url }) => url === '/accounts/account-1/templates/template-1/documents')?.body).toEqual(
      verificationMethod === 'DigitalCertificate'
        ? undefined
        : { name: 'Contrato', signers: [{ role_id: 'role-1', id: 'signer-1', ...channelPayload, ...ordered }] },
    );
    const update = requests.find(({ method, url }) => method === 'put' && url.endsWith('/signers/signer-1'));
    expect(update?.body ?? null).toEqual(signers[0]?.governmentId ? { government_id: '52998224725' } : null);
  });

  it('rejects certificate collect estimates and sends before HTTP with the stable SDK code', async () => {
    const client = createAssinafyClientFactory('https://api.test.invalid/v1')(credential, { accountId: 'account-1' });
    let calls = 0;
    client.getAxiosInstance().defaults.adapter = async () => {
      calls += 1;
      throw new Error('unexpected HTTP request');
    };
    const entries = [{ page_id: 'page-1', fields: [] }];

    await expect(client.assignments.estimateCost('document-1', {
      method: 'collect', signers: [{ verification_method: 'DigitalCertificate' }], entries,
    })).rejects.toMatchObject({ errors: { code: DIGITAL_CERTIFICATE_REQUIRES_VIRTUAL_METHOD } });
    await expect(client.assignments.create('document-1', {
      method: 'collect', signers: [{ id: 'signer-1', verification_method: 'DigitalCertificate' }], entries,
    })).rejects.toMatchObject({ errors: { code: DIGITAL_CERTIFICATE_REQUIRES_VIRTUAL_METHOD } });
    expect(calls).toBe(0);
  });
});

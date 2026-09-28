import { ApiError, type AssinafyClient } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { reportCredentialFailure } from 'src/assinafy-client/report-credential-failure';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { findCompanyContacts } from 'src/data/find-company-contacts';
import { findContacts } from 'src/data/find-contacts';
import { findCrmRecord } from 'src/data/find-crm-record';
import { findPdfAttachments } from 'src/data/find-pdf-attachments';
import { findRecentSends } from 'src/data/find-recent-sends';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type Contact } from 'src/types/contact';
import { type CrmRecord } from 'src/types/crm-record';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type TemplateSummary } from 'src/types/template-summary';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/list-interactive-credentials', () => ({
  listInteractiveCredentials: vi.fn<typeof listInteractiveCredentials>(),
}));
vi.mock('src/assinafy-client/resolve-credential-account', () => ({
  resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>(),
}));
vi.mock('src/data/find-crm-record', () => ({ findCrmRecord: vi.fn<typeof findCrmRecord>() }));
vi.mock('src/data/find-pdf-attachments', () => ({ findPdfAttachments: vi.fn<typeof findPdfAttachments>() }));
vi.mock('src/data/find-contacts', () => ({ findContacts: vi.fn<typeof findContacts>() }));
vi.mock('src/data/find-recent-sends', () => ({ findRecentSends: vi.fn<typeof findRecentSends>() }));
vi.mock('src/data/find-company-contacts', () => ({ findCompanyContacts: vi.fn<typeof findCompanyContacts>() }));
vi.mock('src/services/list-template-summaries.service', () => ({
  listTemplateSummaries: vi.fn<typeof listTemplateSummaries>(),
}));
vi.mock('src/assinafy-client/report-credential-failure', () => ({
  reportCredentialFailure: vi.fn<typeof reportCredentialFailure>(),
}));

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const personal: AssinafyCredential = {
  kind: 'personal',
  connectionId: 'c-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
};
const shared: AssinafyCredential = {
  kind: 'shared',
  connectionId: 'c-2',
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
};
const apiKey: AssinafyCredential = { kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: null };
const client = {} as AssinafyClient;
const resolvedAs = (credential: AssinafyCredential, accountId = 'acc-1'): ResolvedCredential => ({
  credential,
  accountId,
  accountName: 'Acme',
  client,
});
const contact = (personId: string): Contact => ({
  personId,
  name: `Person ${personId}`,
  email: `${personId}@example.invalid`,
  phone: null,
});
const template: TemplateSummary = {
  id: 'tpl-1',
  name: 'NDA',
  documentName: null,
  signerRoles: [{ id: 'r-1', name: 'Client' }],
  editorFields: [],
  unsupportedReason: null,
};
const opportunity: CrmRecord = {
  objectNameSingular: 'opportunity',
  id: RECORD_ID,
  name: 'Big deal',
  primaryContactPersonId: 'p-1',
  companyId: 'co-1',
};

const ctx = buildContext() as MemberHandlerContext;

describe('getSignatureContextHandler', () => {
  beforeEach(() => {
    vi.mocked(findCrmRecord).mockResolvedValue(opportunity);
    vi.mocked(findPdfAttachments).mockResolvedValue([{ id: 'att-1', name: 'contract.pdf' }]);
    vi.mocked(findContacts).mockResolvedValue([contact('p-1')]);
    vi.mocked(findCompanyContacts).mockResolvedValue([contact('p-1'), contact('p-2')]);
    vi.mocked(listTemplateSummaries).mockResolvedValue([template]);
    vi.mocked(findRecentSends).mockResolvedValue([]);
  });

  it('fails with NOT_FOUND when the member cannot read the record', async () => {
    vi.mocked(findCrmRecord).mockResolvedValue(null);

    await expect(getSignatureContextHandler({ recordId: RECORD_ID }, ctx)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(findCrmRecord).toHaveBeenCalledWith(ctx.userCore, RECORD_ID);
    expect(listInteractiveCredentials).not.toHaveBeenCalled();
  });

  it('returns attachments and contacts without Assinafy data when nothing is connected', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);

    await expect(getSignatureContextHandler({ recordId: RECORD_ID }, ctx)).resolves.toEqual({
      record: { objectNameSingular: 'opportunity', id: RECORD_ID, name: 'Big deal' },
      sendingAs: null,
      backgroundSyncAvailable: false,
      templates: [],
      attachments: [{ id: 'att-1', name: 'contract.pdf' }],
      suggestedSigners: [contact('p-1')],
      additionalContacts: [contact('p-2')],
      recentSends: [],
    });
    expect(findPdfAttachments).toHaveBeenCalledExactlyOnceWith(ctx.userCore, opportunity);
    expect(listInteractiveCredentials).toHaveBeenCalledWith('member-1');
    expect(resolveCredentialAccount).not.toHaveBeenCalled();
  });

  it("lists the record's documents from the last hour that may have been sent, as the member", async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);
    const recentSends = [
      { documentRecordId: 'doc-record-1', name: 'Contrato', status: 'PENDING_SIGNATURE' as const },
      { documentRecordId: 'doc-record-2', name: null, status: 'UNCERTAIN' as const },
    ];
    vi.mocked(findRecentSends).mockResolvedValue(recentSends);

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(context.recentSends).toEqual(recentSends);
    expect(findRecentSends).toHaveBeenCalledExactlyOnceWith(ctx.userCore, RECORD_ID, new Date('2026-09-25T11:00:00.000Z'));
  });

  it('answers the send\'s FORBIDDEN when the member cannot read Assinafy documents', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);
    vi.mocked(findRecentSends).mockRejectedValue(permissionDenied());

    const failure = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppFailure);
    expect(failure).toMatchObject({ code: 'FORBIDDEN', details: { reason: 'member_create_permission' } });
  });

  it('fails when the recent documents cannot be read for another reason', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);
    vi.mocked(findRecentSends).mockRejectedValue(new Error('Boom'));

    await expect(getSignatureContextHandler({ recordId: RECORD_ID }, ctx)).rejects.toThrow('Boom');
  });

  it('sends as the first credential and lists its templates', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([shared, apiKey]);
    vi.mocked(resolveCredentialAccount).mockResolvedValue(resolvedAs(shared));

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(context).toMatchObject({
      sendingAs: { kind: 'shared', accountId: 'acc-1', accountName: 'Acme' },
      backgroundSyncAvailable: true,
      templates: [template],
    });
    expect(resolveCredentialAccount).toHaveBeenCalledExactlyOnceWith(shared, ctx.createAssinafyClient);
    expect(listTemplateSummaries).toHaveBeenCalledWith(client);
  });

  it('reports background sync when a shared credential reaches the personal connection account', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([personal, shared, apiKey]);
    vi.mocked(resolveCredentialAccount)
      .mockResolvedValueOnce(resolvedAs(personal))
      .mockRejectedValueOnce(new AppFailure('RECONNECT_REQUIRED', 'Rejected'))
      .mockResolvedValueOnce(resolvedAs(apiKey));

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(context.sendingAs).toEqual({ kind: 'personal', accountId: 'acc-1', accountName: 'Acme' });
    expect(context.backgroundSyncAvailable).toBe(true);
    expect(resolveCredentialAccount).toHaveBeenNthCalledWith(2, shared, ctx.createAssinafyClient);
    expect(resolveCredentialAccount).toHaveBeenNthCalledWith(3, apiKey, ctx.createAssinafyClient);
  });

  it('reports no background sync when no other credential reaches the same account', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([personal, { ...personal, connectionId: 'c-3' }, apiKey]);
    vi.mocked(resolveCredentialAccount)
      .mockResolvedValueOnce(resolvedAs(personal))
      .mockResolvedValueOnce(resolvedAs(apiKey, 'acc-2'));

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(context.backgroundSyncAvailable).toBe(false);
    expect(resolveCredentialAccount).toHaveBeenCalledTimes(2);
  });

  it('propagates a failure to resolve the sending credential', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([personal]);
    vi.mocked(resolveCredentialAccount).mockRejectedValue(new AppFailure('ACCOUNT_REQUIRED', 'Pick one'));

    await expect(getSignatureContextHandler({ recordId: RECORD_ID }, ctx)).rejects.toMatchObject({
      code: 'ACCOUNT_REQUIRED',
    });
  });

  it('maps and reports a template listing failure', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([personal]);
    vi.mocked(resolveCredentialAccount).mockResolvedValue(resolvedAs(personal));
    vi.mocked(listTemplateSummaries).mockRejectedValue(new ApiError('Unauthorized', 401));

    await expect(getSignatureContextHandler({ recordId: RECORD_ID }, ctx)).rejects.toMatchObject({
      code: 'RECONNECT_REQUIRED',
    });
    expect(reportCredentialFailure).toHaveBeenCalledWith(
      personal,
      expect.objectContaining({ code: 'RECONNECT_REQUIRED' }),
    );
  });

  it('suggests a person itself and no company contacts when it has no company', async () => {
    vi.mocked(findCrmRecord).mockResolvedValue({
      objectNameSingular: 'person',
      id: RECORD_ID,
      name: 'Ada',
      primaryContactPersonId: RECORD_ID,
      companyId: null,
    });
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(findContacts).toHaveBeenCalledWith(ctx.userCore, [RECORD_ID]);
    expect(findCompanyContacts).not.toHaveBeenCalled();
    expect(context.additionalContacts).toEqual([]);
  });

  it('suggests nobody for a company and caps its contacts', async () => {
    vi.mocked(findCrmRecord).mockResolvedValue({
      objectNameSingular: 'company',
      id: RECORD_ID,
      name: 'Acme',
      primaryContactPersonId: null,
      companyId: RECORD_ID,
    });
    vi.mocked(findContacts).mockResolvedValue([]);
    vi.mocked(findCompanyContacts).mockResolvedValue(Array.from({ length: 10 }, (_, index) => contact(`p-${index}`)));
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(findContacts).toHaveBeenCalledWith(ctx.userCore, []);
    expect(findCompanyContacts).toHaveBeenCalledWith(ctx.userCore, RECORD_ID, 10);
    expect(context.suggestedSigners).toEqual([]);
    expect(context.additionalContacts).toHaveLength(10);
  });

  it('asks one extra company contact so excluding the suggested signer keeps ten', async () => {
    vi.mocked(listInteractiveCredentials).mockResolvedValue([]);
    vi.mocked(findCompanyContacts).mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => contact(`p-${index + 1}`)),
    );

    const context = await getSignatureContextHandler({ recordId: RECORD_ID }, ctx);

    expect(findCompanyContacts).toHaveBeenCalledWith(ctx.userCore, 'co-1', 11);
    expect(context.additionalContacts.map((item) => item.personId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `p-${index + 2}`),
    );
  });
});

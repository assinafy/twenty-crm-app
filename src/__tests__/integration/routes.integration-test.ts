import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import {
  callRoute,
  clearAssinafyCredential,
  coreClient,
  executeLogicFunction,
  findInstalledApp,
  HAS_WORKSPACE_API_KEY,
  WORKSPACE_API_KEY,
  type InstalledApp,
  metadataClient,
  runCleanup,
  setAppVariable,
  USER_TOKEN,
} from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_API_KEY_VARIABLE } from 'src/constants/assinafy';
import { HEALTH_CHECK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { uploadSignedFile } from 'src/data/upload-signed-file';
import { type Contact } from 'src/types/contact';
import { type DocumentSummary } from 'src/types/document-summary';
import { type SignatureContext } from 'src/types/signature-context';

const UNKNOWN_ID = crypto.randomUUID();
const INVALID_ASSINAFY_KEY = 'invalid-integration-key';

const cleanup: Array<() => Promise<unknown>> = [];
let app: InstalledApp;
let crm: CrmFixtures;

beforeAll(async () => {
  app = await findInstalledApp();
  crm = await createCrmFixtures(cleanup);
});

afterAll(() => runCleanup(cleanup));

const ana = (): Contact => ({
  personId: crm.person.id,
  name: 'Ana Integração',
  email: crm.person.email,
  phone: '+5511987654321',
});
const bruno = (): Contact => ({ personId: crm.colleague.id, name: 'Bruno Integração', email: crm.colleague.email, phone: null });

const prepareBody = () => ({
  recordId: crm.person.id,
  source: { type: 'PDF', attachmentId: crm.pdfAttachment.id },
  name: 'Contract',
  signers: [{ name: 'Ana Integração', email: crm.person.email, verificationMethod: 'Email' }],
});

// A record the app never sent: members may create one with a name only.
const createUnsentDocument = async (): Promise<string> => {
  const core = coreClient(USER_TOKEN);
  const { createAssinafyDocument: created } = await core.mutation({
    createAssinafyDocument: { __args: { data: { name: 'Created outside the app' } }, id: true },
  });
  cleanup.push(() => core.mutation({ destroyAssinafyDocument: { __args: { id: created!.id }, id: true } }));
  return created!.id;
};

describe.skipIf(!HAS_WORKSPACE_API_KEY)('app routes called with the workspace API key', () => {
  it.each([
    ['/s/assinafy/context', {}],
    ['/s/assinafy/prepare', {}],
    ['/s/assinafy/send', {}],
    ['/s/assinafy/discard', {}],
    ['/s/assinafy/documents/refresh', { documentRecordId: UNKNOWN_ID }],
    ['/s/assinafy/documents/resend', { documentRecordId: UNKNOWN_ID, signerId: 'signer1' }],
    ['/s/assinafy/documents/cancel', { documentRecordId: UNKNOWN_ID }],
  ] as const)('%s answers FORBIDDEN', async (path, body) => {
    expect(await callRoute(path, WORKSPACE_API_KEY, body)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
});

describe('app routes called by a workspace member', () => {
  it('rejects a malformed record id and unknown keys', async () => {
    expect(await callRoute('/s/assinafy/context', USER_TOKEN, { recordId: 'not-a-uuid' })).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: expect.any(String), details: { field: 'recordId', reason: 'format' } },
    });
    expect(await callRoute('/s/assinafy/context', USER_TOKEN, { recordId: crm.person.id, extra: true })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { field: 'body.extra', reason: 'unknown_key' } },
    });
    expect(
      await callRoute('/s/assinafy/documents/cancel', USER_TOKEN, { documentRecordId: 'not-a-uuid' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT', details: { field: 'documentRecordId' } } });
  });

  it('/context on a person offers its PDF attachments, the person as signer and the company colleagues', async () => {
    expect(await callRoute<SignatureContext>('/s/assinafy/context', USER_TOKEN, { recordId: crm.person.id })).toEqual({
      ok: true,
      record: { objectNameSingular: 'person', id: crm.person.id, name: 'Ana Integração' },
      sendingAs: null,
      backgroundSyncAvailable: false,
      templates: [],
      attachments: [{ id: crm.pdfAttachment.id, name: crm.pdfAttachment.name }],
      suggestedSigners: [ana()],
      additionalContacts: [bruno()],
      recentSends: [],
    });
  });

  it('/context on an opportunity suggests its point of contact', async () => {
    expect(
      await callRoute<SignatureContext>('/s/assinafy/context', USER_TOKEN, { recordId: crm.opportunity.id }),
    ).toMatchObject({
      ok: true,
      record: { objectNameSingular: 'opportunity', id: crm.opportunity.id },
      attachments: [],
      suggestedSigners: [ana()],
      additionalContacts: [bruno()],
    });
  });

  it('/context on a company suggests nobody and offers its people', async () => {
    expect(
      await callRoute<SignatureContext>('/s/assinafy/context', USER_TOKEN, { recordId: crm.company.id }),
    ).toMatchObject({
      ok: true,
      record: { objectNameSingular: 'company', id: crm.company.id },
      attachments: [],
      suggestedSigners: [],
      additionalContacts: [ana(), bruno()],
    });
  });

  it('/context on an unknown record answers NOT_FOUND', async () => {
    expect(await callRoute('/s/assinafy/context', USER_TOKEN, { recordId: UNKNOWN_ID })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  // /prepare downloads a new attachment inside the function runtime before it looks for an Assinafy credential.
  it('/prepare without an Assinafy credential downloads the PDF, then answers NOT_CONNECTED', async () => {
    expect(await callRoute('/s/assinafy/prepare', USER_TOKEN, prepareBody())).toMatchObject({
      ok: false,
      error: { code: 'NOT_CONNECTED' },
    });
  });

  it('/prepare downloads an attachment that is not a PDF and refuses it', async () => {
    const body = { ...prepareBody(), source: { type: 'PDF', attachmentId: crm.textAttachment.id } };

    expect(await callRoute('/s/assinafy/prepare', USER_TOKEN, body)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.any(String),
        details: { field: 'source.attachmentId', reason: 'NOT_A_PDF' },
      },
    });
  });

  it.each([
    ['/s/assinafy/documents/refresh', { documentRecordId: UNKNOWN_ID }],
    ['/s/assinafy/documents/resend', { documentRecordId: UNKNOWN_ID, signerId: 'signer1' }],
    ['/s/assinafy/documents/cancel', { documentRecordId: UNKNOWN_ID }],
  ] as const)('%s on an unknown document answers NOT_FOUND', async (path, body) => {
    expect(await callRoute(path, USER_TOKEN, body)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  // Checked before any credential lookup: only an upload the app prepared for this member can be discarded.
  it('/discard of an upload the member did not prepare answers INVALID_STATE', async () => {
    expect(
      await callRoute('/s/assinafy/discard', USER_TOKEN, { assinafyDocumentId: 'unsentupload1', accountId: 'account1' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('/documents/cancel and /documents/resend refuse a record the app never sent', async () => {
    const documentRecordId = await createUnsentDocument();

    expect(await callRoute('/s/assinafy/documents/cancel', USER_TOKEN, { documentRecordId })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
    expect(
      await callRoute('/s/assinafy/documents/resend', USER_TOKEN, { documentRecordId, signerId: 'signer1' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('/documents/refresh returns a record the app never sent as it is', async () => {
    const documentRecordId = await createUnsentDocument();

    expect(
      await callRoute<DocumentSummary>('/s/assinafy/documents/refresh', USER_TOKEN, { documentRecordId }),
    ).toMatchObject({ ok: true, documentRecordId, status: 'UNKNOWN' });
  });
});

describe('file storage contract', () => {
  it('an uploadFile id is a valid file id for a FILES field and reads back with a downloadable url', async () => {
    const { attachments } = await coreClient(USER_TOKEN).query({
      attachments: {
        __args: { filter: { id: { eq: crm.pdfAttachment.id } } },
        edges: { node: { file: { fileId: true, label: true, url: true } } },
      },
    });
    const file = attachments?.edges[0]?.node.file?.[0];
    expect(file).toMatchObject({ fileId: crm.pdfAttachment.uploadedFileId, label: crm.pdfAttachment.name });

    const response = await fetch(file!.url!);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(crm.pdf)).toBe(true);
  });

  it('uploadSignedFile stores bytes for signedDocument, which only the app may attach', async () => {
    const stored = await uploadSignedFile(metadataClient(USER_TOKEN), {
      buffer: crm.pdf,
      filename: 'Contract - assinado.pdf',
    });
    expect(stored).toEqual({ fileId: expect.stringMatching(/^[0-9a-f-]{36}$/), label: 'Contract - assinado.pdf' });

    const id = await createUnsentDocument();
    await expect(
      coreClient(USER_TOKEN).mutation({
        updateAssinafyDocument: { __args: { id, data: { signedDocument: [stored] } }, id: true },
      }),
    ).rejects.toThrow(/field "signedDocument" on "assinafyDocument" is not writable through the API/);
  });
});

// Credentialed HTTPS calls from Twenty's function runtime to Assinafy (bundled SDK, axios, network egress) and the
// mapping of the 401 they get. No upload is made: the rejected key stops each flow at the credential check.
describe.skipIf(process.env.ASSINAFY_EGRESS === '0')('with an API key Assinafy rejects', () => {
  beforeAll(() => setAppVariable(app, ASSINAFY_API_KEY_VARIABLE, INVALID_ASSINAFY_KEY));
  afterAll(() => clearAssinafyCredential(app));

  it('/context answers RECONNECT_REQUIRED without echoing the key', async () => {
    const result = await callRoute('/s/assinafy/context', USER_TOKEN, { recordId: crm.person.id });

    expect(result).toMatchObject({ ok: false, error: { code: 'RECONNECT_REQUIRED' } });
    expect(JSON.stringify(result)).not.toContain(INVALID_ASSINAFY_KEY);
  });

  it('/prepare downloads the PDF, then answers RECONNECT_REQUIRED', async () => {
    expect(await callRoute('/s/assinafy/prepare', USER_TOKEN, prepareBody())).toMatchObject({
      ok: false,
      error: { code: 'RECONNECT_REQUIRED' },
    });
  });

  it('the health check reports the rejected key', async () => {
    expect(await executeLogicFunction(app, HEALTH_CHECK_UNIVERSAL_IDENTIFIER)).toMatchObject({
      status: 'SUCCESS',
      data: { status: 'ERROR', title: 'A chave de API da Assinafy foi recusada' },
    });
  });
});

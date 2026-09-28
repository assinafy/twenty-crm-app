import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { findContacts } from 'src/data/find-contacts';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { proposeSignatureRequestHandler } from 'src/logic-functions/handlers/propose-signature-request.handler';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type SignatureContext } from 'src/types/signature-context';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/data/find-contacts', () => ({ findContacts: vi.fn<typeof findContacts>() }));
vi.mock('src/logic-functions/handlers/get-signature-context.handler', () => ({
  getSignatureContextHandler: vi.fn<typeof getSignatureContextHandler>(),
}));

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const ctx = buildContext() as MemberHandlerContext;
const context: SignatureContext = {
  record: { objectNameSingular: 'opportunity', id: RECORD_ID, name: 'Big deal' },
  sendingAs: { kind: 'personal', accountId: 'acc-1', accountName: 'Acme' },
  backgroundSyncAvailable: false,
  templates: [
    {
      id: 'tpl-1',
      name: 'NDA',
      documentName: null,
      signerRoles: [{ id: 'r-1', name: 'Client' }],
      editorFields: [],
      unsupportedReason: null,
    },
    {
      id: 'tpl-2',
      name: 'Copy',
      documentName: null,
      signerRoles: [],
      editorFields: [],
      unsupportedReason: 'UNSUPPORTED_ROLES',
    },
    {
      id: 'tpl-3',
      name: 'Large',
      documentName: null,
      signerRoles: [{ id: 'r-1', name: 'Client' }],
      editorFields: [],
      unsupportedReason: 'TOO_LARGE',
    },
  ],
  attachments: [{ id: 'att-1', name: 'contract.pdf' }],
  suggestedSigners: [],
  additionalContacts: [],
  recentSends: [],
};
const input = {
  recordId: RECORD_ID,
  sourceType: null,
  attachmentId: null,
  templateId: null,
  signerPersonIds: [],
  name: null,
  message: null,
};

describe('proposeSignatureRequestHandler', () => {
  beforeEach(() => {
    vi.mocked(getSignatureContextHandler).mockResolvedValue(context);
    vi.mocked(findContacts).mockResolvedValue([]);
  });

  it('drafts an empty proposal the user completes in the card', async () => {
    await expect(proposeSignatureRequestHandler(input, ctx)).resolves.toEqual({
      proposal: { recordId: RECORD_ID, source: null, name: null, message: null, signers: [] },
    });
    expect(getSignatureContextHandler).toHaveBeenCalledWith({ recordId: RECORD_ID }, ctx);
  });

  it('propagates a missing record', async () => {
    vi.mocked(getSignatureContextHandler).mockRejectedValue(new AppFailure('NOT_FOUND', 'Registro não encontrado.'));

    await expect(proposeSignatureRequestHandler(input, ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('proposes a PDF of the record with CRM signers on free Email verification', async () => {
    vi.mocked(findContacts).mockResolvedValue([
      { personId: 'p-1', name: 'Ada', email: 'ada@example.invalid', phone: '+5511999990000' },
      { personId: 'p-2', name: 'Bob', email: null, phone: null },
    ]);

    const { proposal } = await proposeSignatureRequestHandler(
      { ...input, attachmentId: 'att-1', signerPersonIds: ['p-1', 'p-2'], name: 'Contract', message: 'Please sign' },
      ctx,
    );

    expect(findContacts).toHaveBeenCalledWith(ctx.userCore, ['p-1', 'p-2']);
    expect(proposal).toEqual({
      recordId: RECORD_ID,
      source: { type: 'PDF', attachmentId: 'att-1' },
      name: 'Contract',
      message: 'Please sign',
      signers: [
        {
          name: 'Ada',
          email: 'ada@example.invalid',
          phone: '+5511999990000',
          verificationMethod: 'Email',
          notificationMethod: 'Email',
          governmentId: null,
          roleId: null,
        },
        {
          name: 'Bob',
          email: null,
          phone: null,
          verificationMethod: 'Email',
          notificationMethod: 'Email',
          governmentId: null,
          roleId: null,
        },
      ],
    });
  });

  it('rejects an attachment that is not a PDF of the record', async () => {
    await expect(
      proposeSignatureRequestHandler({ ...input, sourceType: 'PDF', attachmentId: 'att-9' }, ctx),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', details: { field: 'attachmentId', reason: 'not_found' } });
  });

  it('leaves the document open when PDF is chosen without an attachment', async () => {
    const { proposal } = await proposeSignatureRequestHandler(
      { ...input, sourceType: 'PDF', templateId: 'tpl-1' },
      ctx,
    );

    expect(proposal.source).toBeNull();
  });

  it('proposes a ready template', async () => {
    const { proposal } = await proposeSignatureRequestHandler({ ...input, templateId: 'tpl-1' }, ctx);

    expect(proposal.source).toEqual({ type: 'TEMPLATE', templateId: 'tpl-1', editorFields: [] });
  });

  it.each([
    ['tpl-9', 'not_found'],
    ['tpl-2', 'unsupported'],
    ['tpl-3', 'too_large'],
  ])('rejects template %s (%s)', async (templateId, reason) => {
    await expect(
      proposeSignatureRequestHandler({ ...input, sourceType: 'TEMPLATE', templateId }, ctx),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', details: { field: 'templateId', reason } });
  });

  it('rejects people the member cannot read instead of inventing them', async () => {
    vi.mocked(findContacts).mockResolvedValue([{ personId: 'p-1', name: 'Ada', email: null, phone: null }]);

    await expect(
      proposeSignatureRequestHandler({ ...input, signerPersonIds: ['p-1', 'p-2'] }, ctx),
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'signerPersonIds', reason: 'not_found', index: 1 },
    });
  });
});

import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { reportCredentialFailure } from 'src/assinafy-client/report-credential-failure';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { MAX_ADDITIONAL_CONTACTS, RECENT_SEND_WINDOW_MS } from 'src/constants/limits';
import { findCompanyContacts } from 'src/data/find-company-contacts';
import { findContacts } from 'src/data/find-contacts';
import { findCrmRecord } from 'src/data/find-crm-record';
import { findPdfAttachments } from 'src/data/find-pdf-attachments';
import { findRecentSends } from 'src/data/find-recent-sends';
import { isPermissionDenied } from 'src/data/is-permission-denied';
import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type CrmRecord } from 'src/types/crm-record';
import { type HandlerContext } from 'src/types/handler-context';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SignatureContext } from 'src/types/signature-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { cannotCreateDocuments } from 'src/utils/cannot-create-documents.util';
import { toAppError } from 'src/utils/to-app-error.util';

type Sending = Pick<SignatureContext, 'sendingAs' | 'backgroundSyncAvailable' | 'templates'>;

const listTemplates = async (resolved: ResolvedCredential): Promise<SignatureContext['templates']> => {
  try {
    return await listTemplateSummaries(resolved.client);
  } catch (error) {
    const failure = toAppError(error, 'read');
    await reportCredentialFailure(resolved.credential, failure);
    throw failure;
  }
};

// The cron syncs with the API key and shared connections only; documents sent through a personal connection are
// tracked in the background only when one of those reaches the same Assinafy workspace.
const reachesAccountInBackground = async (
  credentials: AssinafyCredential[],
  resolved: ResolvedCredential,
  ctx: HandlerContext,
): Promise<boolean> => {
  if (resolved.credential.kind !== 'personal') return true;

  for (const credential of credentials) {
    if (credential.kind === 'personal') continue;
    const accountId = await resolveCredentialAccount(credential, ctx.createAssinafyClient).then(
      (other) => other.accountId,
      () => null,
    );
    if (accountId === resolved.accountId) return true;
  }
  return false;
};

const loadSending = async (ctx: MemberHandlerContext): Promise<Sending> => {
  const credentials = await listInteractiveCredentials(ctx.userWorkspaceId);
  const [first] = credentials;
  if (!first) return { sendingAs: null, backgroundSyncAvailable: false, templates: [] };

  const resolved = await resolveCredentialAccount(first, ctx.createAssinafyClient);
  const templates = await listTemplates(resolved);

  return {
    sendingAs: { kind: first.kind, accountId: resolved.accountId, accountName: resolved.accountName },
    backgroundSyncAvailable: await reachesAccountInBackground(credentials, resolved, ctx),
    templates,
  };
};

const loadContacts = async (
  ctx: HandlerContext,
  record: CrmRecord,
): Promise<Pick<SignatureContext, 'suggestedSigners' | 'additionalContacts'>> => {
  const suggestedSigners = await findContacts(
    ctx.userCore,
    record.primaryContactPersonId === null ? [] : [record.primaryContactPersonId],
  );
  const suggestedIds = new Set(suggestedSigners.map((contact) => contact.personId));
  // One extra row so excluding the suggested signer still fills the list.
  const companyContacts =
    record.companyId === null
      ? []
      : await findCompanyContacts(ctx.userCore, record.companyId, MAX_ADDITIONAL_CONTACTS + suggestedIds.size);

  return {
    suggestedSigners,
    additionalContacts: companyContacts
      .filter((contact) => !suggestedIds.has(contact.personId))
      .slice(0, MAX_ADDITIONAL_CONTACTS),
  };
};

// Read as the member, like the record's Signatures tab.
const loadRecentSends = async (ctx: HandlerContext, recordId: string): Promise<SignatureContext['recentSends']> => {
  try {
    return await findRecentSends(ctx.userCore, recordId, new Date(ctx.now().getTime() - RECENT_SEND_WINDOW_MS));
  } catch (error) {
    throw isPermissionDenied(error) ? cannotCreateDocuments() : error;
  }
};

export const getSignatureContextHandler = async (
  { recordId }: { recordId: string },
  ctx: MemberHandlerContext,
): Promise<SignatureContext> => {
  const record = await findCrmRecord(ctx.userCore, recordId);
  if (!record) throw new AppFailure('NOT_FOUND', 'Registro não encontrado.');

  const [sending, attachments, contacts, recentSends] = await Promise.all([
    loadSending(ctx),
    findPdfAttachments(ctx.userCore, record),
    loadContacts(ctx, record),
    loadRecentSends(ctx, record.id),
  ]);

  return {
    record: { objectNameSingular: record.objectNameSingular, id: record.id, name: record.name },
    ...sending,
    attachments,
    ...contacts,
    recentSends,
  };
};

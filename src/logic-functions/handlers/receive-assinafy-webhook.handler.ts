import { timingSafeEqual } from 'node:crypto';

import { WebhookVerifier } from '@assinafy/sdk';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type HandlerContext } from 'src/types/handler-context';
import { type WebhookEndpoint } from 'src/types/webhook-endpoint';
import { isFinalStatus } from 'src/utils/is-final-status.util';
import { toAppError } from 'src/utils/to-app-error.util';

export type WebhookOutcome = 'unauthorized' | 'ignored' | 'synced' | 'failed';

const OPERATION = 'receive-assinafy-webhook';

const matchesToken = (expected: string, given: string | undefined): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(given ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
};

// The endpoint whose token the delivery carries, and whose signature it bears when the endpoint is signed.
const authenticate = async (event: RoutePayload): Promise<WebhookEndpoint | null> => {
  const token = event.queryStringParameters?.token;
  const endpoint = (await readWebhookEndpoints()).find((candidate) => matchesToken(candidate.token, token));
  if (!endpoint) return null;
  if (endpoint.secret === null) return endpoint;

  const rawBody = event.isBase64Encoded ? Buffer.from(event.rawBody ?? '', 'base64') : (event.rawBody ?? '');
  return new WebhookVerifier(endpoint.secret).verifySignature(rawBody, event.headers) ? endpoint : null;
};

// The Assinafy document an event is about, when it belongs to the endpoint's workspace.
const readDocumentId = (body: unknown, accountId: string): string | null => {
  const event = body as { account_id?: unknown; object?: { type?: unknown; id?: unknown } } | null;
  if (event?.account_id !== accountId) return null;
  const { type, id } = event.object ?? {};
  return typeof type === 'string' && type.toLowerCase() === 'document' && typeof id === 'string' ? id : null;
};

// An authenticated delivery only triggers a re-read of its document from Assinafy, exactly like the periodic sync:
// nothing in the payload is trusted. A forged or replayed request can at most cause that read.
export const receiveAssinafyWebhookHandler = async (
  event: RoutePayload,
  ctx: HandlerContext,
): Promise<WebhookOutcome> => {
  const endpoint = await authenticate(event);
  if (!endpoint) {
    console.warn(`[assinafy] ${OPERATION}: delivery refused`, { code: 'UNAUTHORIZED' });
    return 'unauthorized';
  }

  const documentId = readDocumentId(event.body, endpoint.accountId);
  if (documentId === null) return 'ignored';

  const [record] = await findAssinafyDocuments(ctx.appCore, {
    filter: { assinafyDocumentId: { eq: documentId } },
    first: 1,
  });
  if (!record || record.assinafyAccountId !== endpoint.accountId || isFinalStatus(record.status)) return 'ignored';

  const resolved = await resolveBackgroundAccounts(OPERATION, await listBackgroundCredentials(), ctx.createAssinafyClient);
  const credential = resolved.find(({ accountId }) => accountId === endpoint.accountId);
  if (!credential) {
    console.warn(`[assinafy] ${OPERATION}: no credential`, { code: 'NO_CREDENTIAL' });
    return 'failed';
  }

  try {
    await syncAssinafyDocument(ctx, record, credential);
    return 'synced';
  } catch (error) {
    console.warn(`[assinafy] ${OPERATION}: sync failed`, { code: toAppError(error, 'read').code });
    return 'failed';
  }
};

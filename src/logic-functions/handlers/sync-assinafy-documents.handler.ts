import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { PENDING_UPLOAD_TTL_MS, SYNC_BATCH_SIZE, SYNC_BUDGET_RATIO, SYNC_TIMEOUT_SECONDS } from 'src/constants/limits';
import { findSyncableAssinafyDocuments } from 'src/data/find-syncable-assinafy-documents';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { purgePendingUploads } from 'src/services/purge-pending-uploads.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';
import { reconcileWebhookEndpoints } from 'src/services/reconcile-webhook-endpoints.service';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type HandlerContext } from 'src/types/handler-context';
import { readWebhookEmail } from 'src/utils/read-webhook-email.util';
import { toAppError } from 'src/utils/to-app-error.util';

type SyncRunCounts = { found: number; synced: number; failed: number; skipped: number; purged: number };

const warn = (event: string, error: unknown): void => {
  console.warn(`[assinafy] sync-assinafy-documents: ${event}`, { code: toAppError(error, 'read').code });
};

export const syncAssinafyDocumentsHandler = async (ctx: HandlerContext): Promise<SyncRunCounts> => {
  const startedAt = ctx.now();
  const records = await findSyncableAssinafyDocuments(ctx.appCore, { now: startedAt, limit: SYNC_BATCH_SIZE });
  const counts: SyncRunCounts = { found: records.length, synced: 0, failed: 0, skipped: 0, purged: 0 };

  const hasExpiredUploads = (await readPendingUploads()).some(
    ({ createdAt }) => Date.parse(createdAt) + PENDING_UPLOAD_TTL_MS <= startedAt.getTime(),
  );

  // Webhooks are reconciled on every run while they are on, and until the endpoints are removed once turned off.
  const webhookEmail = readWebhookEmail();
  const manageWebhooks = webhookEmail !== null || (await readWebhookEndpoints()).length > 0;

  // Most runs have nothing to do; listing connections would refresh their tokens for no reason.
  if (records.length === 0 && !hasExpiredUploads && !manageWebhooks) return counts;

  const resolved = await resolveBackgroundAccounts(
    'sync-assinafy-documents',
    await listBackgroundCredentials(),
    ctx.createAssinafyClient,
  );
  // Stop starting records at a share of the timeout so the usual last record and the purge fit. A run the platform
  // still kills loses nothing: an unwritten record keeps the oldest lastSyncedAt and syncs first on the next run, and
  // the purge resumes from the stored list.
  const deadline = startedAt.getTime() + SYNC_BUDGET_RATIO * SYNC_TIMEOUT_SECONDS * 1000;

  for (const record of records) {
    if (ctx.now().getTime() >= deadline) break;

    const credential = resolved.find((candidate) => candidate.accountId === record.assinafyAccountId);
    try {
      // A send abandoned before Assinafy created its document (the query returns it only past its lease) needs no
      // Assinafy call, so it settles without a credential.
      if (credential || record.assinafyDocumentId === null) {
        await syncAssinafyDocument(ctx, record, credential ?? null);
        counts.synced += 1;
      } else {
        // Advancing lastSyncedAt rotates the record to the back of the queue.
        await updateAssinafyDocument(ctx.appCore, record.id, {
          lastSyncedAt: ctx.now().toISOString(),
          lastError: 'NO_CREDENTIAL',
        });
        counts.skipped += 1;
      }
    } catch (error) {
      counts.failed += 1;
      warn('record failed', error);
    }
  }

  counts.purged = await purgePendingUploads(resolved, ctx.now(), ctx.appCore);
  if (manageWebhooks) {
    await reconcileWebhookEndpoints(resolved, webhookEmail).catch((error: unknown) => warn('webhooks failed', error));
  }
  return counts;
};

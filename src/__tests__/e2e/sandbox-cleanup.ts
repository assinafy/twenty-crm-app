import { type SimLogEntry } from 'src/__tests__/e2e/simulator-client';
import { SANDBOX_BASE_URL } from 'src/__tests__/fixtures/sandbox-base-url';
import { errorName } from 'src/utils/error-name.util';

// Assinafy statuses nothing can change any more; deleting one would gain nothing.
const FINAL_ASSINAFY_STATUSES = ['certificated', 'rejected_by_signer', 'rejected_by_user', 'expired', 'failed'];
const DOCUMENT_PATH = /^\/v1\/documents\/([^/]+)/;

// Deletes, straight in the sandbox, every document the run touched through the simulator that is still open (an
// unsent upload or a request awaiting signatures). Returns how many it deleted; never throws.
export const cleanUpSandboxDocuments = async (log: SimLogEntry[], apiKey: string): Promise<number> => {
  const ids = new Set(
    log.flatMap(({ path }) => {
      const id = DOCUMENT_PATH.exec(path)?.[1];
      return id && id !== 'statuses' ? [id] : [];
    }),
  );
  const headers = { 'X-Api-Key': apiKey, accept: 'application/json' };
  let deleted = 0;

  for (const id of ids) {
    try {
      const details = await fetch(`${SANDBOX_BASE_URL}/documents/${id}`, { headers });
      if (!details.ok) continue;
      const { data } = (await details.json()) as { data?: { status?: string } };
      if (FINAL_ASSINAFY_STATUSES.includes(data?.status?.toLowerCase() ?? '')) continue;
      const response = await fetch(`${SANDBOX_BASE_URL}/documents/${id}`, { method: 'DELETE', headers });
      if (response.ok) deleted += 1;
    } catch (error) {
      console.warn('[e2e] sandbox cleanup failed for one document', { name: errorName(error) });
    }
  }
  return deleted;
};

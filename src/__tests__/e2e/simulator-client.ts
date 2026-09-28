import { dockerExec } from 'src/__tests__/e2e/docker-exec';
import { SIM_URL } from 'src/__tests__/e2e/e2e-constants';

export type SimLogEntry = {
  at: string;
  method: string;
  path: string;
  status: number;
  kind: 'authorize' | 'token' | 'revoke' | 'api' | 'admin';
  grantId?: string;
  // The grant's access-token issuance an API call used: 1 from the code exchange, then one more per refresh.
  tokenIndex?: number;
  grantType?: 'authorization_code' | 'refresh_token' | 'other';
  tokenTypeHint?: 'access_token' | 'refresh_token' | 'other';
  fault?: string;
};

export type SimGrant = {
  id: string;
  accountId: string;
  scopes: string[];
  revoked: boolean;
  refreshCount: number;
  reuseDetected: boolean;
};

export type SimFaultRule = {
  method?: string;
  pathRegex: string;
  times?: number;
  phase?: 'before' | 'after';
  action: { status: number; scopeChallenge?: string; retryAfter?: number } | { delayMs: number } | { reset: true };
};

// Fetches from inside the container (the simulator port is not published). The request travels on stdin; the reply
// is `{ status, location, body }`, with redirects not followed.
const FETCH_SCRIPT = `
let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk)).on('end', async () => {
  const { url, method, body, headers } = JSON.parse(raw);
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  process.stdout.write(JSON.stringify({ status: response.status, location: response.headers.get('location'), body: text }));
});`;

export const fetchInContainer = async (
  url: string,
  { method = 'GET', body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; location: string | null; body: string }> =>
  JSON.parse(await dockerExec(['node', '-e', FETCH_SCRIPT], { input: JSON.stringify({ url, method, body, headers }) }));

const simRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetchInContainer(`${SIM_URL}${path}`, { method, body });
  if (response.status >= 300) throw new Error(`Simulator ${method} ${path} answered ${response.status}`);
  return (response.body ? JSON.parse(response.body) : {}) as T;
};

export const simulator = {
  // Reads a document the way the app does with the API key (forwarded to the sandbox), e.g. to wait for processing.
  documentStatus: async (apiKey: string, documentId: string): Promise<string | null> => {
    const response = await fetchInContainer(`${SIM_URL}/v1/documents/${documentId}`, { headers: { 'X-Api-Key': apiKey } });
    return response.status === 200 ? ((JSON.parse(response.body) as { data?: { status?: string } }).data?.status ?? null) : null;
  },
  health: () => simRequest<{ ok: boolean }>('GET', '/__sim/health'),
  reset: () => simRequest('POST', '/__sim/reset'),
  log: async () => (await simRequest<{ entries: SimLogEntry[] }>('GET', '/__sim/log')).entries,
  // App and Twenty traffic appended after a mark taken with `mark()` (the suite's own admin calls left out).
  mark: async () => (await simulator.log()).length,
  logSince: async (mark: number) => (await simulator.log()).slice(mark).filter(({ kind }) => kind !== 'admin'),
  grants: async () => (await simRequest<{ grants: SimGrant[] }>('GET', '/__sim/grants')).grants,
  revokeGrant: (id: string) => simRequest('POST', `/__sim/grants/${id}/revoke`),
  addFaults: (rules: SimFaultRule[]) => simRequest('POST', '/__sim/faults', { rules }),
  clearFaults: () => simRequest('DELETE', '/__sim/faults'),
  configure: (config: { deny?: boolean; grantedScopes?: string[] | null; accessTtlSeconds?: number }) =>
    simRequest('POST', '/__sim/config', config),
};

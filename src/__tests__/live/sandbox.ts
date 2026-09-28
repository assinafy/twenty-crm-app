import { SANDBOX_BASE_URL } from 'src/__tests__/fixtures/sandbox-base-url';
import { createAssinafyClientFactory } from 'src/assinafy-client/create-assinafy-client-factory';
import { SEND_MIN_EXPIRATION_MINUTES } from 'src/constants/limits';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. The live suite needs Assinafy sandbox credentials in .env (see .env.example).`);
  }
  return value;
};

const optional = (name: string): string | null => process.env[name]?.trim() || null;

// Fails the run (never skips) when a sandbox credential or the one real inbox is missing.
export const readSandboxEnv = () => ({
  credential: {
    kind: 'apiKey' as const,
    apiKey: required('ASSINAFY_SANDBOX_API_KEY'),
    configuredAccountId: required('ASSINAFY_SANDBOX_ACCOUNT_ID'),
  },
  signerEmail: required('ASSINAFY_LIVE_SIGNER_EMAIL'),
  templateId: optional('ASSINAFY_LIVE_TEMPLATE_ID'),
  signedDocumentId: optional('ASSINAFY_LIVE_SIGNED_DOCUMENT_ID'),
});

// Every HTTP answer of the suite's clients (method, path, status), so tests can report what Assinafy returned.
export const httpExchanges: Array<{ method: string; url: string; status: number | null }> = [];

// An axios response carries `status`; an axios error carries `response.status` (none on a network failure).
type Exchange = { config?: { method?: string; url?: string }; status?: number; response?: { status?: number } };

const recordExchange = ({ config, status, response }: Exchange) =>
  httpExchanges.push({
    method: config?.method?.toUpperCase() ?? '?',
    url: config?.url ?? '?',
    status: status ?? response?.status ?? null,
  });

const sandboxFactory = createAssinafyClientFactory(SANDBOX_BASE_URL);

// The only way the suite builds clients: API key only, and the base URL is checked before any request (the SDK then
// pins credentialed requests to that origin).
export const createSandboxClient: CreateAssinafyClient = (credential, options) => {
  if (credential.kind !== 'apiKey') {
    throw new Error('The live suite only uses an API key credential.');
  }
  const client = sandboxFactory(credential, options);
  const http = client.getAxiosInstance();
  if (http.defaults.baseURL !== SANDBOX_BASE_URL) {
    throw new Error('The live suite refuses any Assinafy host other than the sandbox.');
  }

  http.interceptors.response.use(
    (response) => {
      recordExchange(response);
      return response;
    },
    (error: Exchange) => {
      recordExchange(error);
      throw error;
    },
  );
  return client;
};

export const lastStatus = (method: string, url: string): number | null | undefined =>
  httpExchanges.findLast((exchange) => exchange.method === method && exchange.url === url)?.status;

// The send refuses deadlines closer than SEND_MIN_EXPIRATION_MINUTES; one minute more keeps leftovers short-lived.
// Compute it right before each send, since the margin must cover the time between this call and the send.
export const shortDeadline = (now: Date): string =>
  new Date(now.getTime() + (SEND_MIN_EXPIRATION_MINUTES + 1) * 60_000).toISOString();

// Prints an observed contract fact. Every ASSINAFY_* value (key, account, inbox, ids) is redacted, whatever the input.
export const report = (label: string, value: unknown): void => {
  let text = JSON.stringify(value) ?? String(value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (name.startsWith('ASSINAFY_') && secret?.trim()) {
      text = text.replaceAll(secret.trim(), `[${name}]`);
    }
  }
  console.log(`[assinafy-live] ${label}: ${text}`);
};

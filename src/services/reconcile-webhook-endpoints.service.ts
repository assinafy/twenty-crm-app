import { randomBytes } from 'node:crypto';

import { type IWebhookEndpoint } from '@assinafy/sdk';
import { kv } from 'twenty-sdk/logic-function';

import { WEBHOOK_ENDPOINT_NAME, WEBHOOK_EVENTS } from 'src/constants/assinafy';
import { KV_WEBHOOK_ENDPOINTS } from 'src/constants/kv-keys';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type WebhookEndpoint } from 'src/types/webhook-endpoint';
import { getWebhookRoute } from 'src/utils/get-webhook-route.util';
import { toAppError } from 'src/utils/to-app-error.util';

// The token travels in the query string, so an endpoint the app left behind is recognized whatever its token.
const isAtRoute = (url: string, route: string): boolean => url.split('?')[0] === route;

const sameEvents = (events: readonly string[]): boolean =>
  events.length === WEBHOOK_EVENTS.length && WEBHOOK_EVENTS.every((event) => events.includes(event));

const createEndpoint = async (
  { client, credential, accountId }: ResolvedCredential,
  route: string,
  email: string,
): Promise<WebhookEndpoint> => {
  const token = randomBytes(32).toString('base64url');
  const url = `${route}?token=${token}`;
  // Assinafy shows signing secrets to API keys only, so an endpoint registered through OAuth relies on the token.
  const signed = credential.kind === 'apiKey';
  const created = await client.webhooks.createEndpoint({
    name: WEBHOOK_ENDPOINT_NAME,
    url,
    email,
    events: [...WEBHOOK_EVENTS],
    signing_enabled: signed,
  });
  const secret = signed ? (await client.webhooks.getEndpointSecret(created.id)).secret : null;
  return { accountId, endpointId: created.id, url, email, token, secret };
};

const updateEndpoint = async (
  { client }: ResolvedCredential,
  route: string,
  entry: WebhookEndpoint,
  current: IWebhookEndpoint,
  email: string,
): Promise<WebhookEndpoint> => {
  const url = `${route}?token=${entry.token}`;
  if (current.url !== url || current.email !== email || !current.is_active || !sameEvents(current.events)) {
    await client.webhooks.updateEndpoint(current.id, { url, email, events: [...WEBHOOK_EVENTS], is_active: true });
  }
  return { ...entry, url, email };
};

// Brings one Assinafy workspace to the wanted state: an active endpoint when `email` is set, none otherwise. Endpoints
// at the app's route that are not the stored one (an entry lost, the app reinstalled) hold a slot and an unknown
// token, so they are deleted first. Endpoints at other URLs belong to the customer and are never touched.
const reconcileAccount = async (
  resolved: ResolvedCredential,
  route: string,
  entry: WebhookEndpoint | null,
  email: string | null,
): Promise<WebhookEndpoint | null> => {
  const { client } = resolved;
  const endpoints = await client.webhooks.listEndpoints();
  const current = entry ? endpoints.find(({ id }) => id === entry.endpointId) : undefined;

  for (const endpoint of endpoints) {
    if (endpoint !== current && isAtRoute(endpoint.url, route)) {
      await client.webhooks.deleteEndpoint(endpoint.id);
    }
  }

  if (email === null) {
    if (current) await client.webhooks.deleteEndpoint(current.id);
    return null;
  }
  return entry && current
    ? updateEndpoint(resolved, route, entry, current, email)
    : createEndpoint(resolved, route, email);
};

// Registers, updates or removes the app's webhook endpoint in each Assinafy workspace a credential reaches (the first
// credential per workspace manages it). A workspace no credential reaches keeps its stored entry, and a failure keeps
// the previous one: the next run tries again, and the periodic sync covers every document meanwhile.
export const reconcileWebhookEndpoints = async (resolved: ResolvedCredential[], email: string | null): Promise<void> => {
  const route = getWebhookRoute();
  if (route === null) {
    console.warn('[assinafy] webhooks: no functions URL', { code: 'NO_WEBHOOK_URL' });
    return;
  }
  const stored = await readWebhookEndpoints();
  const managers = new Map<string, ResolvedCredential>();
  for (const credential of resolved) {
    if (!managers.has(credential.accountId)) managers.set(credential.accountId, credential);
  }

  const accountIds = new Set([...stored.map(({ accountId }) => accountId), ...managers.keys()]);
  const next: WebhookEndpoint[] = [];
  for (const accountId of accountIds) {
    const entry = stored.find((candidate) => candidate.accountId === accountId) ?? null;
    const manager = managers.get(accountId);
    if (!manager) {
      if (entry) next.push(entry);
      continue;
    }
    try {
      const endpoint = await reconcileAccount(manager, route, entry, email);
      if (endpoint) next.push(endpoint);
    } catch (error) {
      console.warn('[assinafy] webhooks: endpoint not reconciled', { code: toAppError(error, 'mutation').code });
      if (entry) next.push(entry);
    }
  }

  await kv.set(KV_WEBHOOK_ENDPOINTS, next);
};

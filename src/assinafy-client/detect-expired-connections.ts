import {
  type AppConnection,
  AppConnectionAuthFailedError,
  getConnection,
  kv,
  reportConnectionAuthFailure,
} from 'twenty-sdk/logic-function';

import { KV_KNOWN_CONNECTION_IDS } from 'src/constants/kv-keys';
import { errorName } from 'src/utils/error-name.util';

type KnownConnections = Record<string, { missingSince: string | null }>;

const EXPIRED_REASON =
  'A Assinafy encerrou esta conexão: ela foi revogada, autorizada de novo com outras permissões ou ficou 30 dias sem ' +
  'uso. Reconecte para continuar.';
// A connection must stay missing this long before it is flagged, so a short Assinafy outage never flags a working one.
const REPORT_AFTER_MS = 60 * 60 * 1000;

const readKnown = (stored: unknown): KnownConnections => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};

  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, KnownConnections[string]] =>
        typeof entry[1] === 'object' &&
        entry[1] !== null &&
        (typeof entry[1].missingSince === 'string' || entry[1].missingSince === null),
    ),
  );
};

// Twenty stores KV values as jsonb, which reorders object keys, so values are compared with sorted keys.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    typeof nested === 'object' && nested !== null && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).toSorted(([a], [b]) => (a < b ? -1 : 1)))
      : nested,
  );

type Outcome = 'alive' | 'flagged' | 'gone' | 'failing';

const isNotFound = (error: unknown): boolean => error instanceof Error && /not found/i.test(error.message);

const probe = async (connectionId: string): Promise<Outcome> => {
  try {
    await getConnection(connectionId);
    return 'alive';
  } catch (error) {
    if (error instanceof AppConnectionAuthFailedError) return 'flagged';
    return isNotFound(error) ? 'gone' : 'failing';
  }
};

// Twenty cannot flag a connection it no longer finds (e.g. an archived one): that one is gone. Any other failure
// leaves it unflagged, so a later run tries again, without stopping the others.
const flag = async (connectionId: string): Promise<Outcome> => {
  try {
    await reportConnectionAuthFailure({ connectionId, reason: EXPIRED_REASON });
    return 'flagged';
  } catch (error) {
    if (isNotFound(error)) return 'gone';
    console.warn('[assinafy] reporting an expired connection failed', {
      name: errorName(error),
    });
    return 'failing';
  }
};

// listConnections silently drops connections whose refresh failed (revoked, refresh token reused, or not refreshed
// for 30 days) and Twenty does not flag them, so ids that stay missing are flagged here to show "Reconnect needed".
// Only unflagged connections are tracked: a flagged one (listed with authFailedAt, or flagged here) is forgotten, so
// its reason is never overwritten, and a reconnect lists the same id again unflagged. Never throws.
export const detectExpiredConnections = async (
  listed: Pick<AppConnection, 'id' | 'authFailedAt'>[],
  now: Date = new Date(),
): Promise<void> => {
  try {
    const stored = await kv.get<unknown>(KV_KNOWN_CONNECTION_IDS);
    const listedIds = new Set(listed.map((connection) => connection.id));
    const next: KnownConnections = Object.fromEntries(
      listed.filter((connection) => connection.authFailedAt === null).map(({ id }) => [id, { missingSince: null }]),
    );

    for (const [id, state] of Object.entries(readKnown(stored))) {
      if (listedIds.has(id)) continue;

      const missingSince = state.missingSince ?? now.toISOString();
      if (now.getTime() - new Date(missingSince).getTime() < REPORT_AFTER_MS) {
        next[id] = { missingSince };
        continue;
      }

      let outcome = await probe(id);
      if (outcome === 'failing') outcome = await flag(id);
      if (outcome === 'alive') next[id] = { missingSince: null };
      if (outcome === 'failing') next[id] = { missingSince };
    }

    if (canonical(next) !== canonical(stored)) await kv.set(KV_KNOWN_CONNECTION_IDS, next);
  } catch (error) {
    console.warn('[assinafy] detectExpiredConnections failed', {
      name: errorName(error),
    });
  }
};

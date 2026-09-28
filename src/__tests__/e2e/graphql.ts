import { E2E_TWENTY_URL } from 'src/__tests__/e2e/e2e-constants';
import { postGraphql } from 'src/__tests__/integration/post-graphql';

// A raw GraphQL call to the test server as the seeded member (or `token`). Workflow mutations are executable on
// /graphql but absent from its introspection, and /admin-panel has no generated client, so the suite sends text.
export const graphql = <TData = Record<string, unknown>>(
  endpoint: 'graphql' | 'metadata' | 'admin-panel',
  query: string,
  variables: Record<string, unknown> = {},
  token: string = process.env.TWENTY_USER_ACCESS_TOKEN ?? '',
): Promise<TData> => postGraphql<TData>(`${E2E_TWENTY_URL}/${endpoint}`, token, query, variables);

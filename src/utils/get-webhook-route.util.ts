import { WEBHOOK_ROUTE_PATH } from 'src/constants/assinafy';

// Absolute URL of the webhook route. Twenty serves app routes from TWENTY_FUNCTIONS_URL when it sets one (a
// per-workspace domain), else under /s on the API URL. Null when the runtime gives neither.
export const getWebhookRoute = (): string | null => {
  const functionsUrl = process.env.TWENTY_FUNCTIONS_URL?.trim();
  const apiUrl = process.env.TWENTY_API_URL?.trim();
  const base = functionsUrl || (apiUrl ? `${apiUrl}/s` : null);

  return base === null ? null : `${base.replace(/\/+$/, '')}${WEBHOOK_ROUTE_PATH}`;
};

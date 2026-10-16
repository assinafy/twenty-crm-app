// The app's webhook endpoint in one Assinafy workspace. `token` authenticates deliveries (it is part of `url`);
// `secret` verifies their signature. A legacy unsigned OAuth endpoint has null until the next reconciliation replaces it.
export type WebhookEndpoint = {
  accountId: string;
  endpointId: string;
  url: string;
  email: string;
  token: string;
  secret: string | null;
};

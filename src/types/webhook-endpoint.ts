// The app's webhook endpoint in one Assinafy workspace. `token` authenticates deliveries (it is part of `url`);
// `secret` verifies their signature and is null when an OAuth connection registered the endpoint, since Assinafy
// shows signing secrets to API keys only.
export type WebhookEndpoint = {
  accountId: string;
  endpointId: string;
  url: string;
  email: string;
  token: string;
  secret: string | null;
};

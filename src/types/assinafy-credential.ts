export type AssinafyCredential =
  | { kind: 'personal' | 'shared'; connectionId: string; accessToken: string; scopes: string[] }
  | { kind: 'apiKey'; apiKey: string; configuredAccountId: string | null };

import type { Server } from 'node:http';

export declare const createSimulator: (options: {
  upstream: string;
  upstreamApiKey: string;
  accountId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string;
  apiKey?: string;
}) => {
  server: Server;
  listen: (port: number, host?: string) => Promise<{ port: number }>;
  close: () => Promise<void>;
};

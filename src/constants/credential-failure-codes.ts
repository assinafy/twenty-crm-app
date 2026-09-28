import { type AppErrorCode } from 'src/types/app-error-code';

// Failures of one credential (refused, missing scope, no access to the workspace, workspace not chosen) that a person
// can fix; anything else (outage, rate limit) is Assinafy's problem, not the credential's.
export const CREDENTIAL_FAILURE_CODES = [
  'RECONNECT_REQUIRED',
  'INSUFFICIENT_SCOPE',
  'FORBIDDEN',
  'ACCOUNT_REQUIRED',
] as const satisfies readonly AppErrorCode[];

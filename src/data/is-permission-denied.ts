import { hasGraphqlErrorCode } from 'src/data/has-graphql-error-code';

// Twenty 2.42 reports a role that lacks an object permission as a GraphQL error with
// extensions { code: 'FORBIDDEN', subCode: 'PERMISSION_DENIED' } (permissionGraphqlApiExceptionHandler).
// True only when every reported error is a denial, so any partial data that came with it can be trusted.
export const isPermissionDenied = (error: unknown): boolean => hasGraphqlErrorCode(error, 'FORBIDDEN');

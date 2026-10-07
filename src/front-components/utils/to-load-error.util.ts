import { isPermissionDenied } from 'src/data/is-permission-denied';
import { type AppError } from 'src/types/app-error';

// A role that cannot read Assinafy documents gets a reason it can act on, not a retry that never succeeds.
export const toLoadError = (error: unknown): AppError =>
  isPermissionDenied(error)
    ? { code: 'FORBIDDEN', message: '', details: { reason: 'member_read_permission' } }
    : { code: 'INTERNAL', message: '' };

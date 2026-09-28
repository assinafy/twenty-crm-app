import { type AppError } from 'src/types/app-error';

// An action's result (UNCERTAIN, COST_CHANGED, ...) outranks a failed record read after it, so the read never masks
// the guidance the member needs before acting again.
export const getPanelError = (actionError: AppError | null, loadFailed: boolean): AppError | null =>
  actionError ?? (loadFailed ? { code: 'INTERNAL', message: '' } : null);

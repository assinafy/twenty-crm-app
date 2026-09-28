import { type AppErrorCode } from 'src/types/app-error-code';

export type AppError = {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

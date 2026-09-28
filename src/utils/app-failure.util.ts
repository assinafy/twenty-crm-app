import { type AppErrorCode } from 'src/types/app-error-code';

// Expected failure carrying a stable code the front end translates. Handlers throw it; wrappers turn it into an envelope.
export class AppFailure extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppFailure';
    this.code = code;
    this.details = details;
  }
}

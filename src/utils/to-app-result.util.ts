import { type AppResult } from 'src/types/app-result';
import { AppFailure } from 'src/utils/app-failure.util';
import { errorName } from 'src/utils/error-name.util';

// Routes always answer 200 with an envelope; unexpected errors are logged by name only (messages may carry data).
export const toAppResult = async <T extends object>(
  operation: string,
  run: () => Promise<T>,
): Promise<AppResult<T>> => {
  try {
    return { ...(await run()), ok: true };
  } catch (error) {
    if (error instanceof AppFailure) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    console.error(`[assinafy] ${operation} failed`, {
      code: 'INTERNAL',
      name: errorName(error),
    });
    return { ok: false, error: { code: 'INTERNAL', message: 'Erro inesperado.' } };
  }
};

import { toAppError } from 'src/utils/to-app-error.util';

// Called exactly once and never retried: any outcome but a definitive rejection may have sent (and charged) it.
export const billable = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toAppError(error, 'billable');
  }
};

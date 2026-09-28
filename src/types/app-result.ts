import { type AppError } from 'src/types/app-error';

export type AppResult<TData extends object> = ({ ok: true } & TData) | { ok: false; error: AppError };

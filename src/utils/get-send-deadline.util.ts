import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';

// Twenty starts the function timer before the handler runs; this margin covers that start.
const DEADLINE_MARGIN_MS = 10_000;

// Epoch milliseconds after which a send function may be killed.
export const getSendDeadline = (now: Date): number => now.getTime() + SEND_TIMEOUT_SECONDS * 1000 - DEADLINE_MARGIN_MS;

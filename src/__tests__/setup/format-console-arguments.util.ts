import { formatWithOptions } from 'node:util';

// Renders console arguments the way Node's console prints them, including nested objects, error causes and own
// properties such as an HTTP client's request config.
export const formatConsoleArguments = (args: unknown[]): string => formatWithOptions({ depth: 10 }, ...args);

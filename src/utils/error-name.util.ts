// What logs may carry about a thrown value: its class name, never its message (messages can echo tokens or contacts).
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

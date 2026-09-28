// Credits carry two decimals (a WhatsApp notification costs 0.45); comparing cents avoids float noise like 0.45 * 13.
export const toCents = (credits: number): number => Math.round(credits * 100);

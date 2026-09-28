const CREDITS_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

// Credits carry up to two decimals (a WhatsApp invitation costs 0.45).
export const formatCredits = (credits: number): string => CREDITS_FORMAT.format(credits);

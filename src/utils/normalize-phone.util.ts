// E.164 after dropping common separators; Assinafy rejects any other WhatsApp number format.
export const normalizePhone = (raw: string): string | null => {
  const compact = raw.replace(/[\s()./-]/g, '');

  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
};

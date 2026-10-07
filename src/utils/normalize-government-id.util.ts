// CPF (11 digits) or CNPJ (14 characters: 12 letters or digits, then 2 check digits), punctuation removed and letters
// upper-cased. No checksum: Assinafy does not check one either.
export const normalizeGovernmentId = (raw: string): string | null => {
  const compact = raw.replace(/[\s./-]/g, '').toUpperCase();

  return /^(\d{11}|[0-9A-Z]{12}\d{2})$/.test(compact) ? compact : null;
};

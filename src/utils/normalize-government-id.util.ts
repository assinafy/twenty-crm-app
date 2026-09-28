// CPF (11 digits) or CNPJ (14 digits), punctuation removed. No checksum: Assinafy does not check one either.
export const normalizeGovernmentId = (raw: string): string | null => {
  const compact = raw.replace(/[\s./-]/g, '');

  return /^(\d{11}|\d{14})$/.test(compact) ? compact : null;
};

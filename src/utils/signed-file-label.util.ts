const SUFFIX = { certificated: ' - assinado.pdf', pades: ' - ICP-Brasil.pdf' } as const;
const MAX_LABEL_NAME_LENGTH = 150;

export const signedFileLabel = (documentName: string | null, artifact: 'certificated' | 'pades'): string => {
  const cleaned = (documentName ?? '')
    .replace(/[/\\:*?"<>|\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.pdf$/i, '');
  // Code points, so truncation never splits a surrogate pair.
  const name = [...cleaned].slice(0, MAX_LABEL_NAME_LENGTH).join('').trim() || 'documento';
  return `${name}${SUFFIX[artifact]}`;
};

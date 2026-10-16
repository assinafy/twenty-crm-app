import { normalizeGovernmentId } from 'src/utils/normalize-government-id.util';

// Biometric verification requires a CPF with valid check digits; certificate IDs keep their own validation.
export const normalizeCpf = (raw: string): string | null => {
  const cpf = normalizeGovernmentId(raw);
  if (cpf === null || !/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return null;

  for (const position of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < position; index += 1) {
      sum += Number(cpf[index]) * (position + 1 - index);
    }
    if (((sum * 10) % 11) % 10 !== Number(cpf[position])) return null;
  }
  return cpf;
};

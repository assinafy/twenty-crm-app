import { AppFailure } from 'src/utils/app-failure.util';

// Readable text for the reason codes the validators report; `details` keeps the codes for the front end.
const REASON_TEXT: Record<string, string> = {
  required: 'obrigatório',
  type: 'tipo inválido',
  format: 'formato inválido',
  too_long: 'longo demais',
  too_soon: 'prazo curto demais',
  too_few: 'poucos itens',
  too_many: 'itens demais',
  too_large: 'grande demais',
  missing: 'ausente',
  out_of_range: 'fora do intervalo permitido',
  not_found: 'não encontrado',
  unknown: 'desconhecido',
  unknown_key: 'campo desconhecido',
  unsupported: 'não suportado',
  not_allowed: 'não permitido',
  mismatch: 'não corresponde',
  duplicate: 'duplicado',
  conflict: 'valores conflitantes',
  role_count: 'a quantidade não corresponde aos papéis do modelo',
  FILE_TOO_LARGE: 'arquivo grande demais',
  UNSUPPORTED_URL: 'endereço do arquivo não suportado',
  NOT_A_PDF: 'o arquivo não é um PDF',
};

// `index` locates the item when `field` belongs to an array entry (e.g. signers.email of the third signer). `label`
// names the field in the message the way a form shows it to members; `details` always keeps the field key.
export const invalidInput = (field: string, reason: string, index?: number, label?: string): AppFailure =>
  new AppFailure(
    'INVALID_INPUT',
    `${label === undefined ? `Campo ${field}` : `Campo "${label}"`}${index === undefined ? '' : ` (posição ${index + 1})`}: ${REASON_TEXT[reason] ?? reason}.`,
    index === undefined ? { field, reason } : { field, reason, index },
  );

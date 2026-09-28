import { type AppError } from 'src/types/app-error';
import { invalidInput } from 'src/utils/invalid-input.util';

// Workflow builders know the fields by the labels of the action form, not by the keys the validators report.
const FIELD_LABELS: Record<string, string> = {
  record: 'Oportunidade, Pessoa ou Empresa',
  opportunity: 'Oportunidade',
  person: 'Pessoa',
  company: 'Empresa',
  source: 'PDF anexado ou ID do modelo da Assinafy',
  attachment: 'PDF anexado',
  'source.attachmentId': 'PDF anexado',
  templateId: 'ID do modelo da Assinafy',
  'source.templateId': 'ID do modelo da Assinafy',
  'source.editorFields.fieldId': 'Campos do modelo',
  'source.editorFields.value': 'Campos do modelo',
  signers: 'Signatários',
  'signers.roleId': 'Signatários',
  'signers.name': 'Nome do signatário',
  'signers.email': 'E-mail do signatário',
  'signers.phone': 'WhatsApp do signatário',
  'signers.verificationMethod': 'Validação da assinatura',
  'signers.notificationMethod': 'Validação da assinatura',
  verificationMethod: 'Validação da assinatura',
  name: 'Nome do documento',
  message: 'Mensagem para os signatários',
  expiresInDays: 'Prazo para assinar (dias)',
  expiresAt: 'Prazo para assinar (dias)',
  maxCredits: 'Máximo de créditos',
};

export const describeWorkflowError = ({ code, message, details }: AppError): string => {
  const field = details?.field;
  if (code !== 'INVALID_INPUT' || typeof field !== 'string') return message;

  const index = typeof details?.index === 'number' ? details.index : undefined;
  return invalidInput(field, String(details?.reason), index, FIELD_LABELS[field]).message;
};

import { ApiError, NetworkError, ValidationError } from '@assinafy/sdk';

import { AppFailure } from 'src/utils/app-failure.util';
import { sanitizeProviderMessage } from 'src/utils/sanitize-provider-message.util';

type AssinafyOperation = 'read' | 'mutation' | 'billable';

// A billable call that timed out or failed server-side may still have been accepted (and charged) by Assinafy.
const unavailable = (operation: AssinafyOperation): AppFailure =>
  operation === 'billable'
    ? new AppFailure('UNCERTAIN', 'A Assinafy não confirmou a solicitação. Confira na Assinafy antes de tentar novamente.')
    : new AppFailure('PROVIDER_UNAVAILABLE', 'A Assinafy está indisponível no momento. Tente novamente em instantes.');

// Any outcome of a billable call but a definitive rejection may have sent (and charged) it.
const unexpected = (operation: AssinafyOperation): AppFailure =>
  operation === 'billable' ? unavailable(operation) : new AppFailure('INTERNAL', 'Erro inesperado.');

// Only the message of Assinafy's JSON envelope reaches members. A gateway's HTML or text body and the SDK's English
// fallback ('API request failed') give '', and the front end shows its own pt-BR text.
const providerMessage = ({ responseData }: ApiError): string =>
  typeof responseData === 'object' &&
  responseData !== null &&
  typeof (responseData as { message?: unknown }).message === 'string'
    ? (responseData as { message: string }).message
    : '';

const fromApiError = (error: ApiError, operation: AssinafyOperation): AppFailure => {
  const status = error.statusCode;

  if (status === 401) {
    return new AppFailure('RECONNECT_REQUIRED', 'A Assinafy recusou as credenciais. Reconecte a Assinafy ou atualize a chave de API.');
  }
  if (status === 403 && error.challenge?.error === 'insufficient_scope') {
    return new AppFailure(
      'INSUFFICIENT_SCOPE',
      'Falta uma permissão na conexão com a Assinafy. Reconecte a Assinafy.',
      { scope: error.challenge.scope ?? null },
    );
  }
  if (status === 403) {
    return new AppFailure('FORBIDDEN', 'A Assinafy negou o acesso a este workspace ou documento.');
  }
  if (status === 404) {
    return new AppFailure('NOT_FOUND', 'A Assinafy não encontrou este item.');
  }
  if (status === 429) {
    return new AppFailure('RATE_LIMITED', 'A Assinafy está recebendo muitas solicitações. Aguarde um momento e tente novamente.');
  }
  if (status === 408 || status >= 500 || (status === 409 && operation === 'billable')) {
    return unavailable(operation);
  }
  if (status >= 400 && status < 500) {
    const message = sanitizeProviderMessage(providerMessage(error));
    // Marks Assinafy's own text, which the front end prefixes; without one, members get the app's pt-BR refusal.
    return message
      ? new AppFailure('PROVIDER_REJECTED', message, { providerMessage: true })
      : new AppFailure('PROVIDER_REJECTED', 'A Assinafy recusou o documento ou os dados dos signatários.');
  }
  return unexpected(operation);
};

// Pure: maps any thrown value to a stable code without exposing provider bodies (they can hold PII); only a sanitized
// envelope message is passed on. The SDK turns every transport failure into a NetworkError; its ValidationError text
// is English, so members get a fixed message.
export const toAppError = (error: unknown, operation: AssinafyOperation): AppFailure => {
  if (error instanceof AppFailure) return error;
  if (error instanceof ValidationError) {
    return new AppFailure('INVALID_INPUT', 'Os dados da solicitação não são válidos para a Assinafy.');
  }
  if (error instanceof ApiError) return fromApiError(error, operation);
  if (error instanceof NetworkError) return unavailable(operation);
  return unexpected(operation);
};

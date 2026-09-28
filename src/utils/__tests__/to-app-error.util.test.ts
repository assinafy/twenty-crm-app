import { ApiError, AssinafyError, NetworkError, OAuthError, ValidationError } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { AppFailure } from 'src/utils/app-failure.util';
import { toAppError } from 'src/utils/to-app-error.util';

const apiError = (statusCode: number, message = 'Rejected', challenge?: ApiError['challenge']): ApiError => {
  const error = new ApiError(message, statusCode, { message, email: 'ana@example.invalid' });
  if (challenge) error.challenge = challenge;
  return error;
};

describe('toAppError', () => {
  it('passes AppFailure through unchanged', () => {
    const failure = new AppFailure('COST_CHANGED', 'Cost changed');
    expect(toAppError(failure, 'billable')).toBe(failure);
  });

  it.each(['read', 'billable'] as const)('maps ValidationError to INVALID_INPUT with a fixed message (%s)', (operation) => {
    const error = new ValidationError('Signer email invalid: ana@example.invalid', { email: 'x' });

    expect(toAppError(error, operation)).toMatchObject({
      code: 'INVALID_INPUT',
      message: 'Os dados da solicitação não são válidos para a Assinafy.',
      details: undefined,
    });
  });

  it('maps 401 to RECONNECT_REQUIRED (OAuthError included)', () => {
    expect(toAppError(apiError(401), 'read').code).toBe('RECONNECT_REQUIRED');
    expect(toAppError(new OAuthError('invalid_client', null, 401), 'mutation').code).toBe('RECONNECT_REQUIRED');
  });

  it('maps 403 insufficient_scope to INSUFFICIENT_SCOPE with the scope', () => {
    const failure = toAppError(
      apiError(403, 'Forbidden', { scheme: 'Bearer', error: 'insufficient_scope', scope: 'templates:write' }),
      'mutation',
    );
    expect(failure).toMatchObject({ code: 'INSUFFICIENT_SCOPE', details: { scope: 'templates:write' } });
  });

  it('keeps INSUFFICIENT_SCOPE when the challenge names no scope', () => {
    const failure = toAppError(apiError(403, 'Forbidden', { scheme: 'Bearer', error: 'insufficient_scope' }), 'read');
    expect(failure).toMatchObject({ code: 'INSUFFICIENT_SCOPE', details: { scope: null } });
  });

  it('maps other 403s to FORBIDDEN', () => {
    expect(toAppError(apiError(403), 'read').code).toBe('FORBIDDEN');
    expect(toAppError(apiError(403, 'x', { scheme: 'Bearer', error: 'invalid_token' }), 'read').code).toBe('FORBIDDEN');
  });

  it('maps 404 and 429', () => {
    expect(toAppError(apiError(404), 'billable').code).toBe('NOT_FOUND');
    expect(toAppError(apiError(429), 'billable').code).toBe('RATE_LIMITED');
  });

  it.each([408, 409, 500, 502, 503])('maps %i on a billable call to UNCERTAIN', (status) => {
    expect(toAppError(apiError(status), 'billable').code).toBe('UNCERTAIN');
  });

  it.each(['read', 'mutation'] as const)('maps 408 and 5xx on a %s call to PROVIDER_UNAVAILABLE', (operation) => {
    expect(toAppError(apiError(408), operation).code).toBe('PROVIDER_UNAVAILABLE');
    expect(toAppError(apiError(500), operation).code).toBe('PROVIDER_UNAVAILABLE');
  });

  it.each([400, 409, 413, 422, 402])('maps %i on a mutation to PROVIDER_REJECTED, sanitized', (status) => {
    const failure = toAppError(apiError(status, 'Signer ana@example.invalid\nalready exists'), 'mutation');
    expect(failure).toMatchObject({ code: 'PROVIDER_REJECTED', message: 'Signer [e-mail] already exists' });
    expect(failure.details).toEqual({ providerMessage: true });
  });

  it.each([
    ['an envelope without a message', () => ApiError.fromResponse(400, { status: 400, message: '', data: null })],
    ['an empty object', () => ApiError.fromResponse(415, {})],
    ['an OAuth-style error code', () => ApiError.fromResponse(415, { error: 'Unsupported Media Type' })],
    ['no body', () => ApiError.fromResponse(400, null)],
    ['a gateway HTML page', () => ApiError.fromResponse(413, '<html><title>413 Request Entity Too Large</title></html>')],
    ['a gateway text body', () => ApiError.fromResponse(400, 'Bad Request')],
  ])("gives PROVIDER_REJECTED the app's pt-BR refusal for %s", (_label, error) => {
    const failure = toAppError(error(), 'mutation');
    expect(failure).toMatchObject({
      code: 'PROVIDER_REJECTED',
      message: 'A Assinafy recusou o documento ou os dados dos signatários.',
    });
    expect(failure.details).toBeUndefined();
  });

  it('passes on the message of an Assinafy envelope', () => {
    expect(
      toAppError(ApiError.fromResponse(422, { status: 422, message: 'Signatário inválido', data: null }), 'mutation'),
    ).toMatchObject({ code: 'PROVIDER_REJECTED', message: 'Signatário inválido' });
  });

  it('maps a non-error status carried by an envelope to INTERNAL, or UNCERTAIN on a billable call', () => {
    expect(toAppError(apiError(302), 'read')).toMatchObject({ code: 'INTERNAL', message: 'Erro inesperado.' });
    expect(toAppError(apiError(302), 'billable').code).toBe('UNCERTAIN');
  });

  it('maps network failures like 5xx', () => {
    const network = new NetworkError('Failed: timeout');
    expect(toAppError(network, 'read').code).toBe('PROVIDER_UNAVAILABLE');
    expect(toAppError(network, 'billable').code).toBe('UNCERTAIN');
  });

  it.each([
    ['a generic Error', new Error('boom')],
    ['a base SDK error', new AssinafyError('wrapped')],
    ['a string', 'boom'],
    ['null', null],
  ])('maps %s to INTERNAL, or UNCERTAIN on a billable call', (_label, error) => {
    expect(toAppError(error, 'mutation')).toMatchObject({ code: 'INTERNAL', message: 'Erro inesperado.' });
    expect(toAppError(error, 'billable')).toMatchObject({
      code: 'UNCERTAIN',
      message: 'A Assinafy não confirmou a solicitação. Confira na Assinafy antes de tentar novamente.',
    });
  });
});

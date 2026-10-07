import { describe, expect, it } from 'vitest';

import { MAX_EDITOR_FIELDS, MAX_SIGNERS, SEND_MIN_EXPIRATION_MINUTES } from 'src/constants/limits';
import { NOT_CONNECTED_MESSAGE } from 'src/constants/not-connected-message';
import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { type AppErrorCode } from 'src/types/app-error-code';

const CODES: AppErrorCode[] = [
  'INVALID_INPUT',
  'NOT_CONNECTED',
  'RECONNECT_REQUIRED',
  'INSUFFICIENT_SCOPE',
  'FORBIDDEN',
  'ACCOUNT_REQUIRED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'PROVIDER_REJECTED',
  'PROVIDER_UNAVAILABLE',
  'UNCERTAIN',
  'COST_CHANGED',
  'INSUFFICIENT_RESOURCES',
  'COST_LIMIT_EXCEEDED',
  'INVALID_STATE',
  'INTERNAL',
];

const input = (details: Record<string, unknown>) => getErrorMessage({ code: 'INVALID_INPUT', message: '', details });

describe('getErrorMessage', () => {
  it('has a distinct message for every code', () => {
    const messages = CODES.map((code) => getErrorMessage({ code, message: '' }).message.message);

    expect(new Set(messages).size).toBe(CODES.length);
  });

  it.each(['NOT_CONNECTED', 'RECONNECT_REQUIRED'])('points %s to the Twenty settings path', (code) => {
    expect(getErrorMessage({ code }).message.message).toContain('Configurações → Aplicativos → Assinafy');
  });

  it('reads unknown codes as INTERNAL', () => {
    expect(getErrorMessage({ code: 'SIGNED_FILES_PENDING' })).toEqual(getErrorMessage({ code: 'INTERNAL' }));
  });

  it('quotes the sanitized provider message when present', () => {
    expect(
      getErrorMessage({
        code: 'PROVIDER_REJECTED',
        message: 'WhatsApp indisponível no plano',
        details: { providerMessage: true },
      }),
    ).toEqual({
      message: { message: 'A Assinafy recusou a solicitação: {reason}' },
      values: { reason: 'WhatsApp indisponível no plano' },
    });
    expect(getErrorMessage({ code: 'PROVIDER_REJECTED', message: '' }).message.message).toBe(
      'A Assinafy recusou o documento ou os dados dos signatários.',
    );
  });

  it.each([
    'A Assinafy não reenviou o convite.',
    'A Assinafy ainda não permite cancelar este documento. Se ele acabou de ser enviado, tente novamente em instantes.',
  ])('shows the app\'s own refusal text without the provider prefix: %s', (message) => {
    expect(getErrorMessage({ code: 'PROVIDER_REJECTED', message })).toEqual({
      message: { message: '{reason}' },
      values: { reason: message },
    });
    expect(getErrorMessage({ code: 'PROVIDER_REJECTED', message, details: { providerMessage: 'yes' } }).message.message).toBe(
      '{reason}',
    );
  });

  it('tells the member a send the sync found unsent can be sent again', () => {
    const notSent = getErrorMessage({ code: 'NOT_SENT' });

    expect(notSent).not.toEqual(getErrorMessage({ code: 'INTERNAL' }));
    expect(notSent.message.message).toBe(
      'A Assinafy confirmou que a tentativa anterior não foi enviada. Confirme e envie novamente.',
    );
  });

  it.each([
    { field: 'signers.roleId', reason: 'mismatch' },
    { field: 'source.editorFields.fieldId', reason: 'unknown' },
    { field: 'source.editorFields.value', reason: 'missing' },
    { field: 'source.templateId', reason: 'not_found' },
  ])('explains that the template changed in Assinafy for %j', (details) => {
    expect(input(details).message.message).toMatch(/O modelo foi alterado na Assinafy/);
  });

  it('keeps the form messages for template errors the member can fix', () => {
    expect(input({ field: 'signers.roleId', reason: 'duplicate', index: 1 }).message.message).toMatch(
      /signatário diferente/,
    );
    expect(input({ field: 'source.editorFields.value', reason: 'required', index: 0 }).message.message).toMatch(
      /Preencha todos os campos/,
    );
  });

  it('shows the server NOT_CONNECTED text word for word', () => {
    expect(getErrorMessage({ code: 'NOT_CONNECTED' }).message.message).toBe(NOT_CONNECTED_MESSAGE);
  });

  it.each(['source.templateId', 'templateId'])('explains why a template is too large to send (%s)', (field) => {
    expect(input({ field, reason: 'too_large' }).message.message).toBe(
      `Este modelo tem mais de ${MAX_SIGNERS} papéis de signatário ou mais de ${MAX_EDITOR_FIELDS} campos para preencher, por isso não pode ser enviado pelo Twenty.`,
    );
  });

  it('asks for a deadline at least SEND_MIN_EXPIRATION_MINUTES ahead', () => {
    expect(input({ field: 'expiresAt', reason: 'too_soon' }).message.message).toBe(
      `Escolha um prazo de pelo menos ${SEND_MIN_EXPIRATION_MINUTES} minutos a partir de agora.`,
    );
  });

  it('blames the Twenty role when the member cannot create Assinafy documents', () => {
    expect(getErrorMessage({ code: 'FORBIDDEN', details: { reason: 'member_create_permission' } }).message.message).toBe(
      'Sua função no Twenty não permite criar Documentos Assinafy. Peça a um administrador para liberar a edição desse objeto.',
    );
  });

  it('names Twenty when Twenty, not Assinafy, did not answer', () => {
    expect(getErrorMessage({ code: 'PROVIDER_UNAVAILABLE', details: { provider: 'twenty' } }).message.message).toBe(
      'O Twenty não respondeu. Tente novamente em instantes.',
    );
    expect(getErrorMessage({ code: 'PROVIDER_UNAVAILABLE', details: { provider: 'assinafy' } }).message.message).toBe(
      'A Assinafy está indisponível no momento. Tente novamente em alguns minutos.',
    );
  });

  it('blames the Twenty role, not the Assinafy connection, for a member permission refusal', () => {
    expect(getErrorMessage({ code: 'FORBIDDEN', details: { reason: 'member_permission' } }).message.message).toBe(
      'Sua função no Twenty não permite alterar este documento.',
    );
    expect(getErrorMessage({ code: 'FORBIDDEN', details: { reason: 'member_read_permission' } }).message.message).toBe(
      'Sua função no Twenty não permite ver Documentos Assinafy. Peça a um administrador para liberar a leitura desse objeto.',
    );
    expect(getErrorMessage({ code: 'FORBIDDEN', details: { reason: 'other' } }).message.message).toBe(
      'Sua conexão com a Assinafy não tem acesso a este documento ou workspace.',
    );
  });

  it('names the missing scope when known', () => {
    expect(getErrorMessage({ code: 'INSUFFICIENT_SCOPE', details: { scope: 'templates:write' } })).toEqual({
      message: { message: 'Reconecte a Assinafy e conceda a permissão {scope}.' },
      values: { scope: 'templates:write' },
    });
    expect(getErrorMessage({ code: 'INSUFFICIENT_SCOPE', details: { scope: 3 } }).message.message).toBe(
      'Reconecte a Assinafy e conceda todas as permissões solicitadas.',
    );
  });

  it.each([
    ['PendingPayment', 'O workspace da Assinafy tem um pagamento pendente. Regularize-o na Assinafy e revise novamente.'],
    [
      'InsufficientDocuments',
      'O plano do workspace da Assinafy não tem mais documentos disponíveis. Adicione documentos na Assinafy e revise novamente.',
    ],
    [
      'InsufficientCredits',
      'O workspace da Assinafy não tem créditos suficientes. Adicione créditos na Assinafy e revise novamente.',
    ],
    [null, 'O saldo do workspace da Assinafy não é suficiente para esta solicitação.'],
  ])('explains the blocking reason %s', (blockingReason, expected) => {
    expect(getErrorMessage({ code: 'INSUFFICIENT_RESOURCES', details: { blockingReason } }).message.message).toBe(
      expected,
    );
  });

  it('describes signer fields with the 1-based signer number', () => {
    expect(input({ field: 'signers.email', reason: 'format', index: 2 })).toEqual({
      message: { message: 'Signatário {number}: informe um e-mail válido.' },
      values: { number: 3, max: 0 },
    });
    expect(input({ field: 'signers.email', reason: 'duplicate', index: 0 }).message.message).toBe(
      'Signatário {number}: este e-mail já é usado por outro signatário.',
    );
    expect(input({ field: 'signers.phone', reason: 'required', index: 1 }).message.message).toBe(
      'Informe o WhatsApp do signatário {number}.',
    );
  });

  it('passes the field limit for length errors', () => {
    expect(input({ field: 'name', reason: 'too_long' }).values).toEqual({ number: 1, max: 200 });
    expect(input({ field: 'message', reason: 'too_long' }).values).toEqual({ number: 1, max: 1000 });
    expect(input({ field: 'source.editorFields.value', reason: 'too_long', index: 0 }).values).toEqual({
      number: 1,
      max: 500,
    });
    expect(input({ field: 'signers', reason: 'too_many' })).toEqual({
      message: { message: 'Adicione no máximo {max} signatários.' },
      values: { number: 1, max: 20 },
    });
  });

  it('prefers field:reason over the field fallback', () => {
    expect(input({ field: 'name', reason: 'required' }).message.message).toBe('Informe o nome do documento.');
    expect(input({ field: 'source.templateId', reason: 'unsupported' }).message.message).toMatch(/papéis além de signatários/);
    expect(input({ field: 'source.templateId', reason: 'required' }).message.message).toBe(
      'Escolha um modelo da Assinafy.',
    );
  });

  it.each([
    ['FILE_TOO_LARGE', /mais de 25 MB/],
    ['NOT_A_PDF', /não é um PDF válido/],
    ['UNSUPPORTED_URL', /Não foi possível baixar este anexo/],
  ])('explains why the attachment %s cannot be sent', (reason, expected) => {
    expect(input({ field: 'source.attachmentId', reason }).message.message).toMatch(expected);
  });

  it('asks for a PDF when none is chosen', () => {
    expect(input({ field: 'source.attachmentId', reason: 'required' }).message.message).toBe(
      'Escolha um PDF anexado a este registro.',
    );
  });

  it.each([
    [{ field: 'attachmentId', reason: 'not_found' }, /anexo que não está neste registro/],
    [{ field: 'templateId', reason: 'not_found' }, /modelo que não existe/],
    [{ field: 'templateId', reason: 'unsupported' }, /papéis além de signatários/],
    [{ field: 'signerPersonIds', reason: 'not_found', index: 1 }, /pessoa que não foi encontrada/],
  ])('explains the AI proposal error %j', (details, expected) => {
    expect(input(details).message.message).toMatch(expected);
  });

  it('keeps the generic message for other AI proposal errors', () => {
    expect(input({ field: 'signerPersonIds', reason: 'too_many' })).toEqual({
      message: getErrorMessage({ code: 'INVALID_INPUT' }).message,
    });
  });

  it('words the generic message without pointing at a form', () => {
    expect(getErrorMessage({ code: 'INVALID_INPUT' }).message.message).not.toMatch(/formulário/);
  });

  it.each([{ field: 'body.extra', reason: 'unknown_key' }, {}])(
    'falls back to the generic message for %j',
    (details) => {
      expect(input(details)).toEqual({ message: getErrorMessage({ code: 'INVALID_INPUT' }).message });
    },
  );

  it('treats missing details as empty', () => {
    expect(getErrorMessage({ code: 'INVALID_INPUT' }).message.message).toMatch(/ausentes ou inválidas/);
  });
});

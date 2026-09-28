import { STANDARD_OBJECT } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';
import { describe, expect, it, vi } from 'vitest';

import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendForSignatureWorkflowHandler } from 'src/logic-functions/handlers/send-for-signature-workflow.handler';
import sendForSignatureWorkflow from 'src/logic-functions/send-for-signature-workflow.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { type HandlerContext } from 'src/types/handler-context';

vi.mock('src/logic-functions/handlers/send-for-signature-workflow.handler', () => ({
  sendForSignatureWorkflowHandler: vi.fn<typeof sendForSignatureWorkflowHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const action = sendForSignatureWorkflow.config.handler as (payload: unknown, context: unknown) => Promise<unknown>;
const settings = sendForSignatureWorkflow.config.workflowActionTriggerSettings;
const output: Awaited<ReturnType<typeof sendForSignatureWorkflowHandler>> = {
  ok: false,
  documentRecordId: null,
  status: null,
  errorCode: 'UNCERTAIN',
  errorMessage: 'Check',
};

describe('send-for-signature-workflow logic function', () => {
  it('is a workflow action with the send timeout', () => {
    expect(sendForSignatureWorkflow.success).toBe(true);
    expect(sendForSignatureWorkflow.config).toMatchObject({
      universalIdentifier: SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: SEND_TIMEOUT_SECONDS,
    });
    expect(settings).toMatchObject({ label: 'Enviar para assinatura (Assinafy)', icon: 'IconSignature' });
  });

  it('tells builders to leave step retries off instead of promising that a repeated run never sends', () => {
    expect(sendForSignatureWorkflow.config.description).toContain('"Tentar novamente em caso de falha" desativado');
    expect(sendForSignatureWorkflow.config.description).not.toContain('nunca envia de novo');
  });

  it('asks for typed record inputs', () => {
    const properties = settings?.inputSchema?.[0]?.properties;

    expect(properties).toMatchObject({
      attachment: { type: 'record', objectUniversalIdentifier: STANDARD_OBJECT.attachment.universalIdentifier },
      signers: { type: 'records', objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier },
      person: { type: 'record', objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier },
      company: { type: 'record', objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier },
      opportunity: { type: 'record', objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier },
      templateId: { type: 'string' },
      name: { type: 'string' },
      message: { type: 'string', multiline: true },
      verificationMethod: { type: 'string', enum: ['E-mail', 'WhatsApp'] },
      expiresInDays: { type: 'number' },
      maxCredits: { type: 'number' },
    });
    expect(Object.keys(settings?.outputSchema?.[0]?.properties ?? {})).toEqual(Object.keys(output));
  });

  it('runs the handler with an application context and the retry count Twenty gives workflow steps', async () => {
    const ctx = { userWorkspaceId: null } as HandlerContext;
    const executionContext = { userWorkspaceId: null, retryCount: 0, maxRetries: 0 } as LogicFunctionExecutionContext;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(sendForSignatureWorkflowHandler).mockResolvedValue(output);

    await expect(action({ templateId: 'tpl-1' }, executionContext)).resolves.toBe(output);
    expect(buildHandlerContext).toHaveBeenCalledWith(executionContext);
    expect(sendForSignatureWorkflowHandler).toHaveBeenCalledWith({ templateId: 'tpl-1' }, ctx, 0);
  });
});

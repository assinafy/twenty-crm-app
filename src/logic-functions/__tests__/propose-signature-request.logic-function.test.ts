import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import {
  PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
  SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { parseToolCallProposal } from 'src/front-components/utils/parse-tool-call-proposal.util';
import { proposeSignatureRequestHandler } from 'src/logic-functions/handlers/propose-signature-request.handler';
import proposeSignatureRequest from 'src/logic-functions/propose-signature-request.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { type HandlerContext } from 'src/types/handler-context';

vi.mock('src/logic-functions/handlers/propose-signature-request.handler', () => ({
  proposeSignatureRequestHandler: vi.fn<typeof proposeSignatureRequestHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const tool = proposeSignatureRequest.config.handler as (input: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1' } as HandlerContext;
// Twenty's chat wraps a logic-function result before the card reads it.
const asChatOutput = (result: unknown) => ({ success: true, message: 'Logic function executed successfully', result });

describe('propose-signature-request tool', () => {
  it('renders in the signature request card and tells the model it only drafts', () => {
    expect(proposeSignatureRequest.success).toBe(true);
    expect(proposeSignatureRequest.config).toMatchObject({
      universalIdentifier: PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      toolTriggerSettings: {
        frontComponentUniversalIdentifier: SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
        inputSchema: { required: ['recordId'], additionalProperties: false },
      },
    });
    expect(proposeSignatureRequest.config.description).toMatch(/só prepara o rascunho/);
    expect(proposeSignatureRequest.config.description).toMatch(/nunca invente/);
    expect(proposeSignatureRequest.config.description).toMatch(/os custos vêm da Assinafy/);
  });

  it('answers the proposal in the shape the card reads', async () => {
    const proposal = { recordId: RECORD_ID, source: null, name: null, message: null, signers: [] };
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(proposeSignatureRequestHandler).mockResolvedValue({ proposal });

    const output = (await tool({ recordId: RECORD_ID, signerPersonIds: [] }, MEMBER_EXECUTION_CONTEXT)) as Record<
      string,
      unknown
    >;

    expect(output).toEqual({ ok: true, proposal });
    expect(parseToolCallProposal(asChatOutput(output))).toEqual(output);
    expect(proposeSignatureRequestHandler).toHaveBeenCalledWith(expect.objectContaining({ recordId: RECORD_ID }), ctx);
  });

  it('answers failures the card can show', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    const output = (await tool({ recordId: RECORD_ID, email: 'x@example.invalid' }, MEMBER_EXECUTION_CONTEXT)) as Record<
      string,
      unknown
    >;

    expect(output).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(parseToolCallProposal(asChatOutput(output))).toEqual(output);

    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });
    await expect(tool({ recordId: RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    expect(proposeSignatureRequestHandler).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';

import getDocumentStatus from 'src/logic-functions/get-document-status.logic-function';
import getSignatureContextTool from 'src/logic-functions/get-signature-context-tool.logic-function';
import proposeSignatureRequest from 'src/logic-functions/propose-signature-request.logic-function';

const tools = [getDocumentStatus, getSignatureContextTool, proposeSignatureRequest].map(({ config }) => ({
  ...config,
  name: config.name ?? '',
}));

// Twenty 2.42 exposes a logic function to the model as app_<name>, lowercased with every other run of characters
// turned into one underscore (LogicFunctionToolProvider.buildLogicFunctionToolName).
const toToolName = (functionName: string): string =>
  `app_${functionName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;

type Properties = Record<string, { description?: string }>;

const textsOf = (tool: Pick<(typeof tools)[number], 'description' | 'toolTriggerSettings'>): string[] => {
  const schema = tool.toolTriggerSettings?.inputSchema as { properties?: Properties } | undefined;

  return [tool.description ?? '', ...Object.values(schema?.properties ?? {}).map(({ description }) => description ?? '')];
};

describe('AI tool descriptions', () => {
  const toolNames = new Set(tools.map((tool) => toToolName(tool.name)));

  it.each(tools.map((tool) => [tool.name, tool] as const))(
    '%s names other tools only as the model sees them',
    (_name, tool) => {
      const texts = textsOf(tool).join(' ');

      for (const mention of texts.match(/\bapp_[a-z0-9_]+/g) ?? []) {
        expect(toolNames).toContain(mention);
      }
      for (const other of tools) {
        expect(texts).not.toContain(other.name);
      }
      expect(texts).not.toContain('get-signature-context');
    },
  );

  it('points the proposal at the context tool', () => {
    expect(textsOf(proposeSignatureRequest.config).join(' ')).toContain('app_get_signature_context_tool');
    expect(getSignatureContextTool.config.description).toContain('app_propose_signature_request');
  });
});

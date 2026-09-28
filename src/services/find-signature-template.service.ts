import { type AssinafyClient } from '@assinafy/sdk';

import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { type SignatureSource } from 'src/types/signature-source';
import { type SignerInput } from 'src/types/signer-input';
import { type TemplateSummary } from 'src/types/template-summary';
import { assertTemplateSupported } from 'src/utils/assert-template-supported.util';
import { invalidInput } from 'src/utils/invalid-input.util';

// The live template must be ready and sendable, each signer role filled by exactly one signer and every editor field
// given exactly one value: Assinafy would otherwise create (and charge) an incomplete document or reject it late.
export const findSignatureTemplate = async (
  client: AssinafyClient,
  source: Extract<SignatureSource, { type: 'TEMPLATE' }>,
  signers: SignerInput[],
): Promise<TemplateSummary> => {
  const template = (await listTemplateSummaries(client)).find(({ id }) => id === source.templateId) ?? null;

  if (template === null) {
    throw invalidInput('source.templateId', 'not_found');
  }
  assertTemplateSupported(template, 'source.templateId');

  const roleIds = new Set(signers.map((signer) => signer.roleId));
  if (
    signers.length !== template.signerRoles.length ||
    roleIds.size !== signers.length ||
    template.signerRoles.some((role) => !roleIds.has(role.id))
  ) {
    throw invalidInput('signers.roleId', 'mismatch');
  }

  const fieldIds = new Set(template.editorFields.map((field) => field.fieldId));
  const given = new Set(source.editorFields.map((field) => field.fieldId));
  if (given.size !== source.editorFields.length) {
    throw invalidInput('source.editorFields.fieldId', 'duplicate');
  }
  if (source.editorFields.some((field) => !fieldIds.has(field.fieldId))) {
    throw invalidInput('source.editorFields.fieldId', 'unknown');
  }
  if ([...fieldIds].some((fieldId) => !given.has(fieldId))) {
    // 'missing', not 'required': the form showed every field the template had when it opened, so the template changed.
    throw invalidInput('source.editorFields.value', 'missing');
  }

  return template;
};

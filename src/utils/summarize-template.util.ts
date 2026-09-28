import { type ITemplateListItem } from '@assinafy/sdk';

import { MAX_EDITOR_FIELDS, MAX_SIGNERS } from 'src/constants/limits';
import { type TemplateSummary } from 'src/types/template-summary';

// Assinafy returns template statuses and role types in varying case ('Ready', 'Signer').
export const summarizeTemplate = (raw: ITemplateListItem): TemplateSummary | null => {
  if (raw.status?.toLowerCase() !== 'ready') {
    return null;
  }

  const signerRoles: TemplateSummary['signerRoles'] = [];
  const editorRoleIds = new Set<string>();
  let hasOtherRoles = false;
  for (const role of raw.roles ?? []) {
    const type = role.assignment_type?.toLowerCase();
    if (type === 'signer') {
      signerRoles.push({ id: role.id, name: role.name });
    } else if (type === 'editor') {
      editorRoleIds.add(role.id);
    } else {
      hasOtherRoles = true;
    }
  }

  const editorFields = new Map<string, string>();
  for (const field of (raw.pages ?? []).flatMap((page) => page.fields ?? [])) {
    if (field.field_id && field.role_id && editorRoleIds.has(field.role_id) && !editorFields.has(field.field_id)) {
      editorFields.set(field.field_id, field.label || field.field_id);
    }
  }

  const unsupportedReason: TemplateSummary['unsupportedReason'] =
    hasOtherRoles || signerRoles.length === 0
      ? 'UNSUPPORTED_ROLES'
      : signerRoles.length > MAX_SIGNERS || editorFields.size > MAX_EDITOR_FIELDS
        ? 'TOO_LARGE'
        : null;

  return {
    id: raw.id,
    name: raw.name,
    documentName: raw.document_name ?? null,
    signerRoles,
    editorFields: [...editorFields].map(([fieldId, label]) => ({ fieldId, label })),
    unsupportedReason,
  };
};

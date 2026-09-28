// A ready Assinafy template as offered to the user.
export type TemplateSummary = {
  id: string;
  name: string;
  documentName: string | null;
  signerRoles: Array<{ id: string; name: string }>;
  editorFields: Array<{ fieldId: string; label: string }>;
  // Set when the template cannot be sent: roles other than signer/editor (e.g. copy receivers) or no signer role, or
  // more signer roles (MAX_SIGNERS) or editor fields (MAX_EDITOR_FIELDS) than a request accepts.
  unsupportedReason: 'UNSUPPORTED_ROLES' | 'TOO_LARGE' | null;
};

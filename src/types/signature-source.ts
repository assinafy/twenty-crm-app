export type SignatureSource =
  | { type: 'PDF'; attachmentId: string }
  | { type: 'TEMPLATE'; templateId: string; editorFields: Array<{ fieldId: string; value: string }> };

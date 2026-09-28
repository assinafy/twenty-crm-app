import { type CoreApiClient } from 'twenty-client-sdk/core';

import { ATTACHMENT_TARGET_FIELD } from 'src/data/attachment-target-field';
import { readPermitted } from 'src/data/read-permitted';
import { type CrmRecord } from 'src/types/crm-record';
import { type PdfAttachment } from 'src/types/pdf-attachment';
import { type RecordConnection } from 'src/types/record-connection';

type AttachmentNode = {
  id: string;
  name?: string | null;
  file?: Array<{ label: string; extension?: string | null } | null | undefined> | null;
};

const MAX_ATTACHMENTS = 50;

// Twenty files PDFs under fileCategory OTHER, so the type is read from the extension or the name.
const isPdf = (extension: string | null | undefined, name: string): boolean =>
  extension?.replace(/^\./, '').toLowerCase() === 'pdf' || name.toLowerCase().endsWith('.pdf');

// Scans the newest 50 attachments only; filter server-side if records carry many non-PDF files. A member who cannot
// read attachments gets an empty list.
export const findPdfAttachments = async (core: CoreApiClient, record: CrmRecord): Promise<PdfAttachment[]> => {
  const { attachments }: { attachments?: RecordConnection<AttachmentNode> | null } = await readPermitted(() =>
    core.query({
      attachments: {
        __args: {
          filter: { [ATTACHMENT_TARGET_FIELD[record.objectNameSingular]]: { eq: record.id } },
          orderBy: [{ createdAt: 'DescNullsLast' }],
          first: MAX_ATTACHMENTS,
        },
        edges: { node: { id: true, name: true, file: { label: true, extension: true } } },
      },
    }),
  );

  return (attachments?.edges ?? []).flatMap(({ node }) => {
    const file = node.file?.[0];
    // Twenty returns an unset name as ''.
    const name = node.name || file?.label || '';

    return isPdf(file?.extension, name) ? [{ id: node.id, name: name || 'documento.pdf' }] : [];
  });
};

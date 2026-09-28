import { type CoreApiClient } from 'twenty-client-sdk/core';

import { ATTACHMENT_TARGET_FIELD } from 'src/data/attachment-target-field';
import { readPermitted } from 'src/data/read-permitted';
import { type CrmRecord } from 'src/types/crm-record';
import { type RecordConnection } from 'src/types/record-connection';

type AttachmentNode = {
  name?: string | null;
  file?: Array<{ label: string; url?: string | null } | null | undefined> | null;
};

// Null unless the member may read the attachment, it belongs to the record and has a downloadable file.
export const findAttachmentFile = async (
  core: CoreApiClient,
  record: CrmRecord,
  attachmentId: string,
): Promise<{ name: string; url: string } | null> => {
  const { attachments }: { attachments?: RecordConnection<AttachmentNode> | null } = await readPermitted(() =>
    core.query({
      attachments: {
        __args: {
          filter: { id: { eq: attachmentId }, [ATTACHMENT_TARGET_FIELD[record.objectNameSingular]]: { eq: record.id } },
          first: 1,
        },
        edges: { node: { name: true, file: { label: true, url: true } } },
      },
    }),
  );
  const node = attachments?.edges?.[0]?.node;
  const file = node?.file?.[0];

  // Twenty returns an unset name as ''.
  return file?.url ? { name: node?.name || file.label, url: file.url } : null;
};

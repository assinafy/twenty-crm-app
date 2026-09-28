import { type AssinafyClient, MAX_LIST_PAGE_SIZE } from '@assinafy/sdk';

import { type TemplateSummary } from 'src/types/template-summary';
import { summarizeTemplate } from 'src/utils/summarize-template.util';
import { toAppError } from 'src/utils/to-app-error.util';

// First 200 templates only; add search when accounts outgrow it.
const MAX_PAGES = 4;

// Ready templates of the client's account. Failures are mapped as reads.
export const listTemplateSummaries = async (client: AssinafyClient): Promise<TemplateSummary[]> => {
  try {
    const summaries: TemplateSummary[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, meta } = await client.templates.list({ page, per_page: MAX_LIST_PAGE_SIZE });
      summaries.push(...data.flatMap((template) => summarizeTemplate(template) ?? []));

      if (data.length < MAX_LIST_PAGE_SIZE || (meta?.last_page !== undefined && page >= meta.last_page)) break;
    }

    return summaries;
  } catch (error) {
    throw toAppError(error, 'read');
  }
};

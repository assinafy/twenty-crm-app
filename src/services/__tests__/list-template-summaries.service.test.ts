import { ApiError, type AssinafyClient, type ITemplateListItem } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

import { listTemplateSummaries } from 'src/services/list-template-summaries.service';

const template = (id: string, status = 'Ready'): ITemplateListItem =>
  ({
    id,
    name: `Template ${id}`,
    status,
    roles: [{ id: `${id}-signer`, name: 'Client', assignment_type: 'Signer' }],
    created_at: '2026-01-01T00:00:00Z',
  }) as ITemplateListItem;

type ListTemplates = AssinafyClient['templates']['list'];

const page = (count: number, offset: number, meta?: { last_page: number }) => ({
  data: Array.from({ length: count }, (_, index) => template(`t${offset + index}`)),
  meta,
});

const clientWith = (list: ListTemplates) => ({ templates: { list } }) as unknown as AssinafyClient;

describe('listTemplateSummaries', () => {
  it('keeps ready templates of a single short page', async () => {
    const list = vi.fn<ListTemplates>().mockResolvedValue({ data: [template('a'), template('b', 'processing')] });

    const summaries = await listTemplateSummaries(clientWith(list));

    expect(summaries.map((summary) => summary.id)).toEqual(['a']);
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 1, per_page: 50 });
  });

  it('stops at the last page reported by Assinafy', async () => {
    const list = vi
      .fn<ListTemplates>()
      .mockResolvedValueOnce(page(50, 0, { last_page: 2 }))
      .mockResolvedValueOnce(page(50, 50, { last_page: 2 }));

    expect(await listTemplateSummaries(clientWith(list))).toHaveLength(100);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('reads at most four pages', async () => {
    const list = vi.fn<ListTemplates>().mockImplementation(async (params) => page(50, ((params?.page ?? 1) - 1) * 50));

    expect(await listTemplateSummaries(clientWith(list))).toHaveLength(200);
    expect(list).toHaveBeenCalledTimes(4);
  });

  it('maps listing failures as reads', async () => {
    const list = vi.fn<ListTemplates>().mockRejectedValue(new ApiError('Server error', 503));

    await expect(listTemplateSummaries(clientWith(list))).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});

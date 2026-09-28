import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const selected = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock('twenty-sdk/define', () => ({ defineFrontComponent: <T>(config: T) => config }));
vi.mock('twenty-sdk/front-component', () => ({
  enqueueSnackbar: () => undefined,
  msg: (message: string) => ({ message }),
  openCommandConfirmationModal: () => undefined,
  useSelectedRecordIds: () => selected.ids,
  useTranslate: () => ({ t: String }),
}));
vi.mock('twenty-ui/primitives/data-display', () => ({ Tag: () => null }));
vi.mock('twenty-ui/primitives/feedback', () => ({ ProgressBar: () => null }));
vi.mock('twenty-ui/primitives/input', () => ({ Button: () => null }));
vi.mock('src/front-components/components/error-callout', () => ({ ErrorCallout: () => null }));
vi.mock('src/front-components/components/loading-status', () => ({ LoadingStatus: () => null }));
vi.mock('src/front-components/components/signed-downloads', () => ({ SignedDownloads: () => null }));
vi.mock('src/front-components/components/status-tag', () => ({ StatusTag: () => null }));

const { default: panel } = await import('src/front-components/assinafy-document-panel.front-component');

const render = () => (panel as unknown as { component: () => ReactElement<{ recordId: string }> | null }).component();

describe('assinafy document panel', () => {
  beforeEach(() => {
    selected.ids = [];
  });

  // Twenty pushes another record into the mounted widget; the key makes React start the panel's state over.
  it('keys the panel body by the selected record', () => {
    selected.ids = ['record-a'];
    const first = render();

    selected.ids = ['record-b'];
    const second = render();

    expect(first?.key).toBe('record-a');
    expect(first?.props.recordId).toBe('record-a');
    expect(second?.key).toBe('record-b');
    expect(second?.props.recordId).toBe('record-b');
    expect(second?.type).toBe(first?.type);
  });

  it.each([[[]], [['record-a', 'record-b']]])('renders nothing without exactly one selected record (%j)', (ids) => {
    selected.ids = ids;

    expect(render()).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const changed = (previous?: unknown[], next?: unknown[]) =>
  !previous || !next || previous.some((value, position) => !Object.is(value, next[position]));

// A minimal hooks runtime: enough to drive the tab's state without a DOM.
const runtime = vi.hoisted(() => {
  const state = {
    slots: [] as Array<Record<string, unknown>>,
    index: 0,
    dirty: false,
    effects: [] as Array<() => void>,
  };

  return {
    state,
    selected: ['person-1'],
    react: {
      useState(initial: unknown) {
        const slot = (state.slots[state.index++] ??= { value: initial });

        return [
          slot.value,
          (next: unknown) => {
            slot.value = typeof next === 'function' ? (next as (value: unknown) => unknown)(slot.value) : next;
            state.dirty = true;
          },
        ];
      },
      useCallback(callback: unknown, deps: unknown[]) {
        const position = state.index++;
        if (changed(state.slots[position]?.deps as unknown[], deps)) state.slots[position] = { callback, deps };

        return state.slots[position]!.callback;
      },
      useEffect(effect: () => (() => void) | void, deps: unknown[]) {
        const position = state.index++;
        const previous = state.slots[position];
        if (!changed(previous?.deps as unknown[], deps)) return;
        const slot: Record<string, unknown> = { deps };
        state.slots[position] = slot;
        state.effects.push(() => {
          (previous?.cleanup as (() => void) | undefined)?.();
          slot.cleanup = effect();
        });
      },
    },
  };
});

vi.mock('react', () => runtime.react);
vi.mock('twenty-sdk/define', () => ({ defineFrontComponent: (config: unknown) => config }));
vi.mock('twenty-client-sdk/core', () => ({ CoreApiClient: vi.fn<() => object>() }));
vi.mock('twenty-sdk/front-component', () => ({
  openSidePanelPage: vi.fn<() => Promise<void>>(),
  SidePanelPages: { ViewRecord: 'ViewRecord' },
  useSelectedRecordIds: () => runtime.selected,
  useTranslate: () => ({ t: (message: string) => message }),
}));
vi.mock('twenty-ui/primitives/input', () => ({ Button: vi.fn<() => null>() }));
vi.mock('src/front-components/components/error-callout', () => ({ ErrorCallout: vi.fn<() => null>() }));
vi.mock('src/front-components/components/loading-status', () => ({ LoadingStatus: vi.fn<() => null>() }));
vi.mock('src/front-components/components/signed-downloads', () => ({ SignedDownloads: vi.fn<() => null>() }));
vi.mock('src/front-components/components/status-tag', () => ({ StatusTag: vi.fn<() => null>() }));
vi.mock('src/front-components/components/send-flow', () => ({ SendFlow: vi.fn<() => null>() }));
vi.mock('src/data/find-record-documents', () => ({
  findRecordDocuments: vi.fn<typeof findRecordDocuments>(),
}));

import { Button } from 'twenty-ui/primitives/input';

import { SendFlow } from 'src/front-components/components/send-flow';
import { StatusTag } from 'src/front-components/components/status-tag';
import recordSignatures from 'src/front-components/record-signatures.front-component';
import { findRecordDocuments } from 'src/data/find-record-documents';

type Element = { type: unknown; props: { children?: unknown; onClick?: () => void; onSendSettled?: () => void } };

type Keyed = { key: string; type: (props: unknown) => Element; props: unknown };
const RecordSignatures = (recordSignatures as unknown as { component: () => Keyed | null }).component;
const UNCERTAIN = { id: 'doc-1', name: 'Contrato', status: 'UNCERTAIN', signedCount: 0, signerCount: 1, sentAt: null };
let tree: Element;

const render = () => {
  runtime.state.index = 0;
  runtime.state.dirty = false;
  const tab = RecordSignatures()!;
  tree = tab.type(tab.props);
  runtime.state.effects.splice(0).forEach((effect) => effect());
};
const settle = async () => {
  for (let round = 0; round < 10; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (runtime.state.dirty) render();
  }
};
const elements = (node: unknown): Element[] =>
  Array.isArray(node)
    ? node.flatMap(elements)
    : typeof node === 'object' && node !== null && 'props' in node
      ? [node as Element, ...elements((node as Element).props.children)]
      : [];
const ofType = (type: unknown) => elements(tree).filter((node) => node.type === type);
const button = (label: string) => ofType(Button).find((node) => node.props.children === label)!;

describe('record signatures tab', () => {
  beforeEach(() => {
    runtime.state.slots = [];
    runtime.selected = ['person-1'];
    vi.mocked(findRecordDocuments).mockReset().mockResolvedValueOnce([]).mockResolvedValue([UNCERTAIN] as never);
  });

  // Twenty pushes another record into the mounted tab; the key makes React start the tab's state over.
  it('keys the tab by the selected record', () => {
    const first = RecordSignatures();
    runtime.selected = ['person-2'];
    const second = RecordSignatures();

    expect([first?.key, second?.key]).toEqual(['person-1', 'person-2']);
    expect(second?.props).toEqual({ recordId: 'person-2' });
    runtime.selected = ['person-1', 'person-2'];
    expect(RecordSignatures()).toBeNull();
  });

  it('reloads the list when the member goes back from the send flow', async () => {
    render();
    await settle();
    button('Enviar para assinatura').props.onClick!();
    await settle();

    button('Voltar aos documentos').props.onClick!();
    await settle();

    expect(findRecordDocuments).toHaveBeenCalledTimes(2);
    expect(ofType(StatusTag)).toHaveLength(1);
  });

  it('reloads the list once a send answers, even after the member left the flow', async () => {
    render();
    await settle();
    button('Enviar para assinatura').props.onClick!();
    await settle();
    const settled = ofType(SendFlow)[0]!.props.onSendSettled!;

    button('Voltar aos documentos').props.onClick!();
    await settle();
    expect(findRecordDocuments).toHaveBeenCalledTimes(2);
    expect(ofType(SendFlow)).toHaveLength(0);

    settled();
    await settle();

    expect(findRecordDocuments).toHaveBeenCalledTimes(3);
  });
});

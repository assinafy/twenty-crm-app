import { beforeEach, describe, expect, it, vi } from 'vitest';

const changed = (previous?: unknown[], next?: unknown[]) =>
  !previous || !next || previous.some((value, index) => !Object.is(value, next[index]));

const runtime = vi.hoisted(() => {
  const state = { slots: [] as Array<Record<string, unknown>>, index: 0, dirty: false, effects: [] as Array<() => void> };
  const useState = (initial: unknown) => {
    const position = state.index++;
    const slot = state.slots[position] ??= { value: typeof initial === 'function' ? (initial as () => unknown)() : initial };
    return [slot.value, (next: unknown) => {
      slot.value = typeof next === 'function' ? (next as (value: unknown) => unknown)(slot.value) : next;
      state.dirty = true;
    }];
  };
  return {
    state,
    react: {
      useState,
      useRef(initial: unknown) {
        const position = state.index++;
        return state.slots[position] ??= { current: initial };
      },
      useReducer(reducer: (state: unknown, action: unknown) => unknown, initial: unknown) {
        const [value, set] = useState(initial);
        return [value, (action: unknown) => (set as (value: unknown) => void)((previous: unknown) => reducer(previous, action))];
      },
      useCallback(callback: unknown, deps: unknown[]) {
        const position = state.index++;
        if (changed(state.slots[position]?.deps as unknown[], deps)) state.slots[position] = { callback, deps };
        return state.slots[position]!.callback;
      },
      useEffect(effect: () => void, deps: unknown[]) {
        const position = state.index++;
        if (!changed(state.slots[position]?.deps as unknown[], deps)) return;
        state.slots[position] = { deps };
        state.effects.push(effect);
      },
    },
  };
});

vi.mock('react', () => runtime.react);
vi.mock('twenty-sdk/front-component', () => ({
  openCommandConfirmationModal: vi.fn<() => Promise<'confirm' | 'cancel'>>(),
  useTranslate: () => ({ t: (message: string) => message }),
}));
vi.mock('twenty-ui/primitives/input', () => ({ Button: vi.fn<() => null>() }));
vi.mock('src/front-components/components/checkbox-input', () => ({ CheckboxInput: vi.fn<() => null>() }));
vi.mock('src/front-components/components/error-callout', () => ({ ErrorCallout: vi.fn<() => null>() }));
vi.mock('src/front-components/components/loading-status', () => ({ LoadingStatus: vi.fn<() => null>() }));
vi.mock('src/front-components/components/select-input', () => ({ SelectInput: vi.fn<() => null>() }));
vi.mock('src/front-components/components/text-input', () => ({ TextInput: vi.fn<() => null>() }));
vi.mock('src/front-components/utils/call-app-route.util', () => ({ callAppRoute: vi.fn<typeof callAppRoute>() }));

import { openCommandConfirmationModal } from 'twenty-sdk/front-component';
import { Button } from 'twenty-ui/primitives/input';

import { ContractPanel } from 'src/front-components/components/contract-panel';
import { LoadingStatus } from 'src/front-components/components/loading-status';
import { SelectInput } from 'src/front-components/components/select-input';
import { TextInput } from 'src/front-components/components/text-input';
import { contract } from 'src/front-components/utils/__tests__/contract-fixtures';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';
import { createExclusiveRunner } from 'src/front-components/utils/create-exclusive-runner.util';
import { type AppResult } from 'src/types/app-result';
import { type ContractSummary } from 'src/types/contract-summary';
import { type ContractTerms } from 'src/types/contract-terms';

type Element = { type: unknown; props: {
  children?: unknown;
  label?: string;
  disabled?: boolean;
  editable?: boolean;
  options?: Array<{ value: string; disabled?: boolean }>;
  onClick?: () => void;
  onChange?: (value: string) => void;
  save?: (terms: ContractTerms) => void;
} };

let tree: Element;
let component: () => Element;
let disabled: boolean;
let runTask: (task: () => Promise<void>) => Promise<void>;
const response = (value: ContractSummary | null = contract()): AppResult<{ contract: ContractSummary | null }> => ({ ok: true, contract: value });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
};
const render = () => {
  runtime.state.index = 0;
  runtime.state.dirty = false;
  tree = component();
  runtime.state.effects.splice(0).forEach((effect) => effect());
};
const settle = async () => {
  for (let round = 0; round < 8; round += 1) {
    await Promise.resolve();
    if (runtime.state.dirty) render();
  }
};
const elements = (node: unknown): Element[] => Array.isArray(node) ? node.flatMap(elements)
  : typeof node === 'object' && node !== null && 'props' in node
    ? [node as Element, ...elements((node as Element).props.children)] : [];
const button = (label: string) => elements(tree).find((node) => node.type === Button && node.props.children === label)!;
const editor = () => elements(tree).find((node) => typeof node.props.save === 'function');

const open = async () => {
  render();
  button('Gestão do contrato').props.onClick!();
  await settle();
  const content = tree;
  runtime.state.slots = [];
  component = () => (content.type as (props: unknown) => Element)({ ...content.props, disabled });
  render();
  await settle();
};

describe('contract panel', () => {
  beforeEach(() => {
    runtime.state.slots = [];
    runtime.state.effects = [];
    disabled = false;
    runTask = createExclusiveRunner((error) => { throw error; });
    component = () => ContractPanel({ documentRecordId: 'record-1', disabled, runTask });
    vi.mocked(callAppRoute).mockReset().mockResolvedValue(response());
    vi.mocked(openCommandConfirmationModal).mockReset().mockResolvedValue('confirm');
  });

  it('waits for the member to open contract management before querying', async () => {
    render();
    expect(callAppRoute).not.toHaveBeenCalled();
    await open();
    expect(callAppRoute).toHaveBeenCalledExactlyOnceWith('/s/assinafy/documents/contract', { documentRecordId: 'record-1', action: 'get' });
  });

  it('waits for a signature action to finish when opening from an older enabled render', async () => {
    const pending = deferred<void>();
    const signature = runTask(() => pending.promise);
    await open();
    expect(callAppRoute).not.toHaveBeenCalled();
    expect(elements(tree).some((node) => node.type === LoadingStatus)).toBe(false);
    disabled = true;
    render();
    pending.resolve();
    await signature;
    disabled = false;
    render();
    await settle();
    expect(callAppRoute).toHaveBeenCalledOnce();
    expect(editor()?.props.disabled).toBe(false);
  });

  it('keeps signature actions out while the contract request is running and releases the lock', async () => {
    const pending = deferred<AppResult<{ contract: ContractSummary | null }>>();
    vi.mocked(callAppRoute).mockReturnValueOnce(pending.promise);
    await open();
    expect(elements(tree).some((node) => node.type === LoadingStatus)).toBe(true);
    const signature = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await runTask(signature);
    expect(signature).not.toHaveBeenCalled();
    pending.resolve(response());
    await settle();
    await runTask(signature);
    expect(signature).toHaveBeenCalledOnce();
    expect(elements(tree).some((node) => node.type === LoadingStatus)).toBe(false);
  });

  it('renews with the reviewed term and version only after confirmation', async () => {
    await open();
    vi.mocked(openCommandConfirmationModal).mockResolvedValueOnce('cancel');
    button('Renovar contrato').props.onClick!();
    await settle();
    expect(callAppRoute).toHaveBeenCalledTimes(1);
    button('Renovar contrato').props.onClick!();
    await settle();
    expect(callAppRoute).toHaveBeenLastCalledWith('/s/assinafy/documents/contract', {
      documentRecordId: 'record-1', action: 'renew', term: 1, updatedAt: contract().updatedAt,
    });
    expect(openCommandConfirmationModal).toHaveBeenCalledWith(expect.objectContaining({ confirmButtonAccent: 'blue' }));
  });

  it('confirms termination and sends the optional reason', async () => {
    await open();
    elements(tree).find((node) => node.type === TextInput && node.props.label === 'Motivo do encerramento (opcional)')!.props.onChange!(' Substituído ');
    await settle();
    button('Encerrar contrato').props.onClick!();
    await settle();
    expect(callAppRoute).toHaveBeenLastCalledWith('/s/assinafy/documents/contract', {
      documentRecordId: 'record-1', action: 'terminate', reason: 'Substituído', updatedAt: contract().updatedAt,
    });
    expect(openCommandConfirmationModal).toHaveBeenCalledWith(expect.objectContaining({ confirmButtonAccent: 'danger' }));
  });

  it('blocks another change after a lost mutation response until a successful refresh', async () => {
    await open();
    vi.mocked(callAppRoute).mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'Unexpected response' } });
    button('Renovar contrato').props.onClick!();
    await settle();
    expect(button('Renovar contrato').props.disabled).toBe(true);
    expect(button('Encerrar contrato').props.disabled).toBe(true);
    expect(editor()?.props.disabled).toBe(true);
    expect(button('Atualizar contrato').props.disabled).toBe(false);
    button('Atualizar contrato').props.onClick!();
    await settle();
    expect(callAppRoute).toHaveBeenLastCalledWith('/s/assinafy/documents/contract', { documentRecordId: 'record-1', action: 'get' });
    expect(editor()?.props.disabled).toBe(false);
  });

  it('releases loading and requires reconciliation after an unexpected mutation throw', async () => {
    await open();
    vi.mocked(callAppRoute).mockRejectedValueOnce(new Error('Client initialization failed'));
    button('Renovar contrato').props.onClick!();
    await settle();
    expect(elements(tree).some((node) => node.type === LoadingStatus)).toBe(false);
    expect(editor()?.props.disabled).toBe(true);
    expect(button('Atualizar contrato').props.disabled).toBe(false);
    button('Atualizar contrato').props.onClick!();
    await settle();
    expect(editor()?.props.disabled).toBe(false);
  });

  it('does not offer moving a contract in force back to draft', async () => {
    await open();
    const form = editor()!;
    runtime.state.slots = [];
    component = () => (form.type as (props: unknown) => Element)(form.props);
    render();
    const status = elements(tree).find((node) => node.type === SelectInput)!;
    expect(status.props.options?.find((option) => option.value === 'draft')?.disabled).toBe(true);
    expect(status.props.options?.find((option) => option.value === 'active')?.disabled).not.toBe(true);
  });

  it('shows an amendment without offering root changes', async () => {
    vi.mocked(callAppRoute).mockResolvedValue(response({
      kind: 'amendment', status: 'pending', relationType: 'amendment', appliedAt: null, updatedAt: contract().updatedAt,
    }));
    await open();
    expect(editor()).toBeUndefined();
    expect(button('Renovar contrato')).toBeUndefined();
    expect(button('Encerrar contrato')).toBeUndefined();
  });
});

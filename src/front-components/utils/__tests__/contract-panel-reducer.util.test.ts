import { describe, expect, it } from 'vitest';

import { contract, panelState } from 'src/front-components/utils/__tests__/contract-fixtures';
import { contractPanelReducer } from 'src/front-components/utils/contract-panel-reducer.util';

describe('contractPanelReducer', () => {
  it('locks the controls during a request and clears the previous error', () => {
    expect(contractPanelReducer(panelState({ error: { code: 'INVALID_INPUT', message: '' } }), { type: 'START' })).toMatchObject({ busy: true, error: null });
  });

  it.each(['CONTRACT_CHANGED', 'CONTRACT_UNCERTAIN', 'INTERNAL'] as const)('requires a fresh read after mutation error %s', (code) => {
    const failed = contractPanelReducer(panelState(), { type: 'SETTLE', mutation: true, result: { ok: false, error: { code, message: '' } } });
    expect(failed).toMatchObject({ refreshRequired: true, busy: false, error: { code }, contract: contract() });
    const readFailed = contractPanelReducer(failed, { type: 'SETTLE', mutation: false, result: { ok: false, error: { code: 'PROVIDER_UNAVAILABLE', message: '' } } });
    expect(readFailed.refreshRequired).toBe(true);
    const refreshed = contractPanelReducer(readFailed, { type: 'SETTLE', mutation: false, result: { ok: true, contract: contract({ term: 2 }) } });
    expect(refreshed).toMatchObject({ refreshRequired: false, busy: false, error: null, revision: 2, contract: { term: 2 } });
  });

  it('keeps validation failures editable without dropping the last read terms', () => {
    expect(contractPanelReducer(panelState(), { type: 'SETTLE', mutation: true, result: { ok: false, error: { code: 'INVALID_INPUT', message: '' } } })).toMatchObject({
      refreshRequired: false, contract: contract(), revision: 1,
    });
  });

  it('does not offer editing after the first read fails', () => {
    expect(contractPanelReducer(panelState({ loaded: false, contract: null }), { type: 'SETTLE', mutation: false, result: { ok: false, error: { code: 'INTERNAL', message: '' } } })).toMatchObject({ loaded: false, contract: null, refreshRequired: false });
  });

  it('starts a clean draft after a successful read reports no contract', () => {
    expect(contractPanelReducer(panelState(), { type: 'SETTLE', mutation: false, result: { ok: true, contract: null } })).toMatchObject({ loaded: true, contract: null, revision: 2 });
  });
});

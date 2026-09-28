import { describe, expect, it, vi } from 'vitest';

import { NO_ENVELOPE_MESSAGE } from 'src/constants/app-route';
import { estimate, summary } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { runResendFlow } from 'src/front-components/utils/run-resend-flow.util';
import { type CostEstimate } from 'src/types/cost-estimate';

type Call = Parameters<typeof runResendFlow>[0]['call'];

const ids = { documentRecordId: 'record-doc-1', signerId: 'signer-1' };

describe('runResendFlow', () => {
  it('asks for confirmation and resends at exactly the quoted cost', async () => {
    const quote = estimate({ totalCredits: 0.45 });
    const call = vi
      .fn<Call>()
      .mockResolvedValueOnce({ ok: true, estimate: quote })
      .mockResolvedValueOnce({ ok: true, ...summary() });
    const confirm = vi.fn<(quote: CostEstimate) => Promise<boolean>>(async () => true);

    await expect(runResendFlow({ ...ids, call, confirm })).resolves.toEqual({ ok: true, ...summary() });
    expect(call.mock.calls).toEqual([
      [{ ...ids, expectedTotalCredits: null }],
      [{ ...ids, expectedTotalCredits: 0.45 }],
    ]);
    expect(confirm).toHaveBeenCalledWith(quote);
  });

  it('resends a free invitation without asking', async () => {
    const call = vi
      .fn<Call>()
      .mockResolvedValueOnce({ ok: true, estimate: estimate({ totalCredits: 0.004 }) })
      .mockResolvedValueOnce({ ok: true, ...summary() });
    const confirm = vi.fn<(quote: CostEstimate) => Promise<boolean>>(async () => true);

    await expect(runResendFlow({ ...ids, call, confirm })).resolves.toMatchObject({ ok: true });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stops when the user declines', async () => {
    const call = vi.fn<Call>().mockResolvedValueOnce({ ok: true, estimate: estimate() });

    await expect(runResendFlow({ ...ids, call, confirm: async () => false })).resolves.toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('reports insufficient resources without resending', async () => {
    const call = vi.fn<Call>().mockResolvedValueOnce({
      ok: true,
      estimate: estimate({ sufficient: false, blockingReason: 'InsufficientCredits' }),
    });

    await expect(runResendFlow({ ...ids, call, confirm: async () => true })).resolves.toEqual({
      ok: false,
      error: { code: 'INSUFFICIENT_RESOURCES', message: '', details: { blockingReason: 'InsufficientCredits' } },
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('returns a failed quote or a direct summary unchanged', async () => {
    const failure = { ok: false as const, error: { code: 'INVALID_STATE' as const, message: 'Signed' } };

    await expect(
      runResendFlow({ ...ids, call: vi.fn<Call>().mockResolvedValue(failure), confirm: async () => true }),
    ).resolves.toBe(failure);

    const direct = { ok: true as const, ...summary() };
    await expect(
      runResendFlow({ ...ids, call: vi.fn<Call>().mockResolvedValue(direct), confirm: async () => true }),
    ).resolves.toBe(direct);
  });

  it('returns the failure of the resend itself', async () => {
    const failure = { ok: false as const, error: { code: 'COST_CHANGED' as const, message: '' } };
    const call = vi.fn<Call>().mockResolvedValueOnce({ ok: true, estimate: estimate() }).mockResolvedValueOnce(failure);

    await expect(runResendFlow({ ...ids, call, confirm: async () => true })).resolves.toBe(failure);
  });

  it('reports an unknown outcome when the answer to the confirmed resend is lost', async () => {
    const call = vi
      .fn<Call>()
      .mockResolvedValueOnce({ ok: true, estimate: estimate() })
      .mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: NO_ENVELOPE_MESSAGE } });

    await expect(runResendFlow({ ...ids, call, confirm: async () => true })).resolves.toEqual({
      ok: false,
      error: { code: 'UNCERTAIN', message: '' },
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("keeps the route's own INTERNAL on the confirmed resend, since it fails before resending", async () => {
    const failure = { ok: false as const, error: { code: 'INTERNAL' as const, message: 'Erro inesperado.' } };
    const call = vi.fn<Call>().mockResolvedValueOnce({ ok: true, estimate: estimate() }).mockResolvedValueOnce(failure);

    await expect(runResendFlow({ ...ids, call, confirm: async () => true })).resolves.toBe(failure);
  });

  it('keeps a failed quote INTERNAL, since nothing was resent', async () => {
    const failure = { ok: false as const, error: { code: 'INTERNAL' as const, message: NO_ENVELOPE_MESSAGE } };

    await expect(
      runResendFlow({ ...ids, call: vi.fn<Call>().mockResolvedValue(failure), confirm: async () => true }),
    ).resolves.toBe(failure);
  });

  it('rejects a second quote', async () => {
    const call = vi.fn<Call>().mockResolvedValue({ ok: true, estimate: estimate() });

    await expect(runResendFlow({ ...ids, call, confirm: async () => true })).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Unexpected quote' },
    });
  });
});

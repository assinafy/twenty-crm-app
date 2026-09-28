import { describe, expect, it, vi } from 'vitest';

import { estimate } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { confirmResend } from 'src/front-components/utils/confirm-resend.util';

type Open = Parameters<typeof confirmResend>[0]['open'];

const t = (descriptor: unknown, values?: Record<string, unknown>) =>
  `${String(descriptor)}${values ? ` ${JSON.stringify(values)}` : ''}`;

describe('confirmResend', () => {
  it('asks with a non-danger accent and shows the quoted credits', async () => {
    const open = vi.fn<Open>(async () => 'confirm');

    await expect(confirmResend({ estimate: estimate({ totalCredits: 0.45 }), t, open })).resolves.toBe(true);

    const [params] = open.mock.calls[0] ?? [];

    expect(params?.confirmButtonAccent).toBe('blue');
    expect(params?.title).toBe('Reenviar o convite?');
    expect(params?.confirmButtonText).toBe('Reenviar');
    expect(params?.subtitle).toContain('0,45');
  });

  it('resolves false when the member cancels', async () => {
    await expect(
      confirmResend({ estimate: estimate(), t, open: vi.fn<Open>(async () => 'cancel') }),
    ).resolves.toBe(false);
  });
});

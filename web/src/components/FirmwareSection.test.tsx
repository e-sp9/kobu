import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The firmware module is cached at module scope, so reload the
 * component (and every transitive module behind it) between tests.
 *
 * IMPORTANT: after `vi.resetModules()` the connection store also gets
 * a fresh instance, so callers must use the store returned here — not
 * the one imported from this file's top-level — when priming state.
 */
async function freshFirmwareSection() {
  vi.resetModules();
  const componentMod = await import('./FirmwareSection');
  const connectionMod = await import('../state/connection');
  return {
    FirmwareSection: componentMod.FirmwareSection,
    useConnectionStore: connectionMod.useConnectionStore,
  };
}

function mockFetchOk(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  });
}

function fixtureLatestRelease() {
  return [
    {
      tag_name: 'firmware-latest',
      name: 'Latest firmware build (abc1234)',
      prerelease: true,
      draft: false,
      published_at: '2026-05-20T01:00:00Z',
      html_url: 'https://github.com/s-katada/kobu/releases/tag/firmware-latest',
      body: 'Released notes content.',
      assets: [
        {
          name: 'central.uf2',
          size: 902656,
          browser_download_url:
            'https://github.com/s-katada/kobu/releases/download/firmware-latest/central.uf2',
        },
        {
          name: 'peripheral.uf2',
          size: 581632,
          browser_download_url:
            'https://github.com/s-katada/kobu/releases/download/firmware-latest/peripheral.uf2',
        },
      ],
    },
  ];
}

describe('FirmwareSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the loading state immediately and the release card once the fetch resolves', async () => {
    vi.stubGlobal('fetch', mockFetchOk(fixtureLatestRelease()));
    const { FirmwareSection } = await freshFirmwareSection();
    render(<FirmwareSection />);

    expect(screen.getByText('リリース情報を取得中…')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('Latest firmware build (abc1234)')).toBeInTheDocument(),
    );
    expect(screen.getByText('latest')).toBeInTheDocument();
    // download links
    const centralLink = screen.getByRole('link', { name: /セントラル/ });
    expect(centralLink).toHaveAttribute(
      'href',
      'https://github.com/s-katada/kobu/releases/download/firmware-latest/central.uf2',
    );
    expect(centralLink).toHaveAttribute('download', 'central.uf2');
    const peripheralLink = screen.getByRole('link', { name: /ペリフェラル/ });
    expect(peripheralLink).toHaveAttribute(
      'href',
      'https://github.com/s-katada/kobu/releases/download/firmware-latest/peripheral.uf2',
    );
  });

  it('renders the empty state when no firmware releases exist', async () => {
    vi.stubGlobal('fetch', mockFetchOk([]));
    const { FirmwareSection } = await freshFirmwareSection();
    render(<FirmwareSection />);
    await waitFor(() =>
      expect(
        screen.getByText(/公開済みのファームウェアビルドがまだありません/),
      ).toBeInTheDocument(),
    );
  });

  it('renders an error state when the API returns 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, statusText: 'limit', json: async () => ({}) }),
    );
    const { FirmwareSection } = await freshFirmwareSection();
    render(<FirmwareSection />);
    await waitFor(() =>
      expect(screen.getByText(/リリース情報の取得に失敗しました/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/rate-limited/)).toBeInTheDocument();
  });

  it('disables ブートローダへ移行 when no kobu is connected and explains why', async () => {
    vi.stubGlobal('fetch', mockFetchOk(fixtureLatestRelease()));
    const { FirmwareSection } = await freshFirmwareSection();
    render(<FirmwareSection />);
    await waitFor(() =>
      expect(screen.getByText('Latest firmware build (abc1234)')).toBeInTheDocument(),
    );
    const button = screen.getByRole('button', { name: /ブートローダへ移行/ });
    expect(button).toBeDisabled();
    expect(screen.getByText(/接続中のときに有効になります/)).toBeInTheDocument();
  });

  it('enables and invokes enterBootloader when a kobu is connected', async () => {
    vi.stubGlobal('fetch', mockFetchOk(fixtureLatestRelease()));
    const { FirmwareSection, useConnectionStore } = await freshFirmwareSection();
    const { TransportError } = await import('../transport/types');

    const sendAndReceive = vi.fn(async () => {
      throw new TransportError('receive-timeout', 'simulated');
    });
    useConnectionStore.setState({
      state: {
        kind: 'ready',
        transport: { sendAndReceive } as never,
        handshake: {
          viaProtocolVersion: 0x0009,
          keyboardId: {
            vialProtocolVersion: 6,
            uid: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
            featureFlags: 0,
          },
          definition: { matrix: { rows: 4, cols: 10 }, layouts: { keymap: [] } },
          isKobu: true,
        },
        deviceName: 'kobu',
        definitionFromCache: false,
      },
    });

    render(<FirmwareSection />);
    await waitFor(() =>
      expect(screen.getByText('Latest firmware build (abc1234)')).toBeInTheDocument(),
    );

    const button = screen.getByRole('button', { name: /ブートローダへ移行/ });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(sendAndReceive).toHaveBeenCalledTimes(1);
    const firstCall = sendAndReceive.mock.calls[0] as unknown as [Uint8Array] | undefined;
    const sentPacket = firstCall?.[0];
    expect(sentPacket?.[0]).toBe(0x0b);
  });

  it('clicking 再取得 forces a refetch (cache reset)', async () => {
    const fetchMock = mockFetchOk(fixtureLatestRelease());
    vi.stubGlobal('fetch', fetchMock);
    const { FirmwareSection } = await freshFirmwareSection();
    render(<FirmwareSection />);
    await waitFor(() =>
      expect(screen.getByText('Latest firmware build (abc1234)')).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: '再取得' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

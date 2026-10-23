import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

vi.mock('@/lib/ssrf', () => ({
  checkUpstreamAllowed: vi.fn(async () => ({ ok: true })),
}));

const SOURCE = { key: 'example', name: 'Example CMS', url: 'https://cms.example.com/api.php/provide/vod' };

function makeRequest(id: string): Request {
  const { token } = signSession();
  const params = new URLSearchParams({ id, source: JSON.stringify(SOURCE) });
  return new Request('https://local.test/api/detail?' + params.toString(), {
    headers: { cookie: SESSION_COOKIE + '=' + token },
  });
}

beforeAll(() => {
  process.env.PASSWORD = 'test-password-123';
});

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/detail', () => {
  it('returns playable episodes from the standard Apple CMS details response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        list: [{ vod_id: 101, vod_name: 'Sample', vod_play_url: 'Episode 1$https://cdn.example.com/episode.m3u8' }],
      }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(makeRequest('101'));
    const data = (await response.json()) as { episodes: string[] };
    expect(response.status).toBe(200);
    expect(data.episodes).toEqual(['https://cdn.example.com/episode.m3u8']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a helpful 504 when the provider times out instead of spinning indefinitely', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('Request timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(makeRequest('102'));
    const data = (await response.json()) as { error: string };
    expect(response.status).toBe(504);
    expect(data.error).toMatch(/did not respond in time/);
    // Timeouts must not trigger another long HTML fallback request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the CMS has no playable URLs and the HTML fallback fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('index.php/vod/detail')) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify({ list: [{ vod_id: 103, vod_name: 'Sample', vod_play_url: '' }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(makeRequest('103'));
    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


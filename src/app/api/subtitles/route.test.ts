import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

const upstream = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fetch-utils', () => ({ fetchUpstream: upstream }));

function req(path: string, method = 'GET', body?: unknown): Request {
  const { token } = signSession();
  return new Request('https://local.test' + path, {
    method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(() => { process.env.PASSWORD = 'subtitle-test-password'; });
afterEach(() => { upstream.mockReset(); delete process.env.OPENSUBTITLES_API_KEY; });

describe('/api/subtitles', () => {
  it('reports missing provider configuration without exposing credentials', async () => {
    const response = await GET(req('/api/subtitles?title=Reacher&language=en'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false, items: [] });
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated subtitle searches', async () => {
    const response = await GET(new Request('https://local.test/api/subtitles?title=Reacher&language=en'));
    expect(response.status).toBe(401);
  });
  it('filters OpenSubtitles results to requested language and text file types', async () => {
    process.env.OPENSUBTITLES_API_KEY = 'private-test-key';
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { attributes: { language: 'ar', release: 'Reacher Arabic', download_count: 50, files: [{ file_id: 41, file_name: 'arabic.srt' }] } },
      { attributes: { language: 'en', release: 'Reacher English', download_count: 100, files: [{ file_id: 42, file_name: 'english.srt' }] } },
      { attributes: { language: 'en', release: 'ZIP', files: [{ file_id: 43, file_name: 'archive.zip' }] } },
    ] }), { status: 200 }));
    const response = await GET(req('/api/subtitles?title=Reacher&language=en'));
    const data = await response.json() as { configured: boolean; items: { fileId: number }[] };
    expect(data.items).toEqual([{ fileId: 42, language: 'en', release: 'Reacher English', fileName: 'english.srt', downloads: 100 }]);
    expect(upstream.mock.calls[0][1].headers['Api-Key']).toBe('private-test-key');
    expect(data).not.toHaveProperty('key');
  });
  it('accepts extensionless subtitle filenames returned by the live OpenSubtitles API', async () => {
    process.env.OPENSUBTITLES_API_KEY = 'private-test-key';
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { attributes: { language: 'en', release: 'Jack Reacher Never Go Back 2016 HD-T', download_count: 636,
        files: [{ file_id: 9268514, cd_number: 1, file_name: 'Jack Reacher Never Go Back 2016 HD-T' }] } },
      { attributes: { language: 'en', release: 'Archive only', files: [{ file_id: 55, file_name: 'archive.zip' }] } },
    ] }), { status: 200 }));
    const response = await GET(req('/api/subtitles?title=Jack%20Reacher%202&language=en'));
    const data = await response.json() as { configured: boolean; items: { fileId: number; release: string }[] };
    expect(response.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.items).toEqual([expect.objectContaining({
      fileId: 9268514,
      release: 'Jack Reacher Never Go Back 2016 HD-T',
    })]);
  });

  it('downloads and converts an SRT without exposing upstream download URL', async () => {
    process.env.OPENSUBTITLES_API_KEY = 'private-test-key';
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ link: 'https://download.opensubtitles.com/film.srt' })));
    upstream.mockResolvedValueOnce(new Response('1\n00:00:01,000 --> 00:00:02,000\nمرحبا'));
    const response = await POST(req('/api/subtitles', 'POST', { fileId: 42 }));
    expect(response.status).toBe(200);
    const data = await response.json() as { vtt: string };
    expect(data.vtt).toContain('WEBVTT');
    expect(data.vtt).toContain('مرحبا');
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('shows a clear message when the provider authorizes a download but its file host blocks access', async () => {
    process.env.OPENSUBTITLES_API_KEY = 'private-test-key';
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ link: 'https://www.opensubtitles.com/download/test.srt' })));
    upstream.mockResolvedValueOnce(new Response('Access denied', { status: 403 }));
    const response = await POST(req('/api/subtitles', 'POST', { fileId: 9268514 }));
    const body = await response.json() as { error: string };
    expect(response.status).toBe(502);
    expect(body.error).toMatch(/blocked this subtitle download.*403/);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('blocks external download hosts and invalid IDs', async () => {
    process.env.OPENSUBTITLES_API_KEY = 'private-test-key';
    const invalid = await POST(req('/api/subtitles', 'POST', { fileId: '42' }));
    expect(invalid.status).toBe(400);
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ link: 'https://attacker.example/track.srt' })));
    const response = await POST(req('/api/subtitles', 'POST', { fileId: 42 }));
    expect(response.status).toBe(502);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

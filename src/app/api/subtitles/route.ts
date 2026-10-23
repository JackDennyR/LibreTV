import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { fetchUpstream } from '@/lib/fetch-utils';
import { toWebVtt, type SubtitleChoice, type SubtitleLanguage } from '@/lib/subtitles';

export const runtime = 'nodejs';
const BASE = 'https://api.opensubtitles.com/api/v1';
const MAX_FILE_BYTES = 1_000_000;

type ApiFile = { file_id?: unknown; file_name?: unknown };
type ApiResult = {
  attributes?: {
    language?: unknown;
    release?: unknown;
    download_count?: unknown;
    files?: ApiFile[];
  };
};

function headers(key: string): Record<string, string> {
  return { 'Api-Key': key, 'User-Agent': 'LibreTV v2.20.1', Accept: 'application/json' };
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Authenticated catalog search; the private OpenSubtitles API key never goes to browsers. */
export async function GET(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  const key = process.env.OPENSUBTITLES_API_KEY?.trim();
  if (!key) return NextResponse.json({ configured: false, items: [] });
  const params = new URL(req.url).searchParams;
  const title = (params.get('title') || '').trim();
  const language = params.get('language');
  if (title.length < 2 || title.length > 120 || (language !== 'en' && language !== 'ar')) {
    return errorResponse(400, 'Enter a movie title and select English or Arabic.');
  }
  try {
    const query = new URLSearchParams({ languages: language, query: title });
    const response = await fetchUpstream(`${BASE}/subtitles?${query}`, { timeoutMs: 8000, headers: headers(key) });
    if (!response.ok) return errorResponse(502, `Subtitle provider returned HTTP ${response.status}`);
    const data = await response.json() as { data?: ApiResult[] };
    const results: SubtitleChoice[] = [];
    for (const entry of Array.isArray(data.data) ? data.data : []) {
      const attr = entry.attributes;
      if (!attr || attr.language !== language) continue;
      // OpenSubtitles commonly omits the file extension even for valid SRT
      // files (e.g. "Jack Reacher Never Go Back 2016 HD-T"). The API's
      // numeric file_id, not its display filename, identifies the subtitle.
      // Never accept archives: the download route validates subtitle text.
      const file = Array.isArray(attr.files) ? attr.files.find((f) =>
        Number.isSafeInteger(f.file_id) && Number(f.file_id) > 0 &&
        !/\.(?:zip|rar|7z|tar|gz)$/i.test(String(f.file_name || ''))
      ) : undefined;
      if (!file) continue;
      results.push({
        fileId: Number(file.file_id), language: language as SubtitleLanguage,
        fileName: String(file.file_name).slice(0, 160),
        release: String(attr.release || file.file_name).slice(0, 160),
        downloads: Number(attr.download_count) || 0,
      });
      if (results.length >= 15) break;
    }
    return NextResponse.json({ configured: true, items: results });
  } catch {
    return errorResponse(502, 'Subtitle search is currently unavailable.');
  }
}

/** Obtain a temporary subtitle from OpenSubtitles and return validated VTT, not a remote download URL. */
export async function POST(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  const key = process.env.OPENSUBTITLES_API_KEY?.trim();
  if (!key) return errorResponse(503, 'Set OPENSUBTITLES_API_KEY in Railway to enable automatic subtitles.');
  let fileId: unknown;
  try { ({ fileId } = await req.json() as { fileId?: unknown }); } catch { return errorResponse(400, 'Invalid request.'); }
  if (typeof fileId !== 'number' || !Number.isSafeInteger(fileId) || fileId <= 0) {
    return errorResponse(400, 'Invalid subtitle file ID.');
  }
  try {
    const download = await fetchUpstream(`${BASE}/download`, {
      method: 'POST', timeoutMs: 8000,
      headers: { ...headers(key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!download.ok) return errorResponse(download.status === 429 ? 429 : 502,
      download.status === 429 ? 'OpenSubtitles download limit reached.' : `Subtitle download failed (HTTP ${download.status}).`);
    const data = await download.json() as { link?: string };
    // The download link is provider-generated, but restrict it to TLS and a known provider host.
    const link = new URL(String(data.link || ''));
    if (link.protocol !== 'https:' || !/(^|\.)(opensubtitles\.com|oscdn\.com)$/.test(link.hostname)) {
      return errorResponse(502, 'Untrusted subtitle download location.');
    }
    const file = await fetchUpstream(link.href, { timeoutMs: 8000 });
    if (!file.ok) return errorResponse(502, file.status === 403
      ? 'OpenSubtitles blocked this subtitle download (HTTP 403). Try another release or upload a subtitle file.'
      : 'Subtitle file is unavailable. Try another release or upload a subtitle file.');
    if (Number(file.headers.get('content-length')) > MAX_FILE_BYTES) return errorResponse(413, 'Subtitle exceeds 1 MB.');
    const raw = await file.arrayBuffer();
    if (raw.byteLength > MAX_FILE_BYTES) return errorResponse(413, 'Subtitle exceeds 1 MB.');
    return NextResponse.json({ vtt: toWebVtt(new TextDecoder().decode(raw)) });
  } catch {
    return errorResponse(502, 'Unable to fetch this subtitle. Try another release or upload a local file.');
  }
}

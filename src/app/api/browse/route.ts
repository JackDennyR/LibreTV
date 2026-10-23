import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { categoriesFromCms, isAdultCategory, type BrowseCategory } from '@/lib/browse-categories';
import { cmsRequestHeaders, filterAdultResults, parseSearchList } from '@/lib/cms-parser';
import { fetchUpstream, getCache, setCache } from '@/lib/fetch-utils';
import { checkUpstreamAllowed } from '@/lib/ssrf';
import type { SourceConfig, SearchResultItem } from '@/lib/types';

export const runtime = 'nodejs';
type BrowseBody = { action?: 'categories' | 'browse'; source?: SourceConfig; genre?: string; year?: number; page?: number; allowAdult?: boolean };
const categoryCacheTtl = 10 * 60_000;
const fail = (status: number, error: string) => NextResponse.json({error}, {status});

async function loadCategories(source: SourceConfig): Promise<BrowseCategory[]> {
  const cacheKey = 'browse-categories:' + source.url;
  const cached = getCache<BrowseCategory[]>(cacheKey);
  if (cached) return cached;
  const url = new URL(source.url);
  url.searchParams.set('ac', 'list');
  const response = await fetchUpstream(url.href, { timeoutMs: 9000, headers: cmsRequestHeaders() });
  if (!response.ok) throw new Error('Genre catalog unavailable (HTTP ' + response.status + ')');
  const list = categoriesFromCms(await response.json());
  setCache(cacheKey, list, categoryCacheTtl);
  return list;
}
export async function POST(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  let body: BrowseBody;
  try { body = await req.json() as BrowseBody; } catch { return fail(400,'Invalid request'); }
  const source = body.source;
  if (!source || typeof source.key !== 'string' || typeof source.name !== 'string' ||
    typeof source.url !== 'string' || source.url.length > 800) return fail(400,'Invalid movie source');
  try {
    const verdict = await checkUpstreamAllowed(source.url);
    if (!verdict.ok) return fail(400,'Invalid or restricted movie source URL');
    if (source.isAdult && !body.allowAdult) return fail(403,'This source requires explicit 18+ selection');
    const genres = await loadCategories(source);
    if (body.action === 'categories') return NextResponse.json({genres});
    if (body.action !== 'browse') return fail(400,'Invalid action');
    const genre = genres.find((g) => g.key === body.genre);
    if (!genre) return fail(400,'Select an available genre');
    if (genre.adult && !body.allowAdult) return fail(403,'Confirm 18+ access before browsing this genre');
    if (body.allowAdult && !genre.adult) return fail(400,'Adult mode is only supported in the 18+ genre');
    const year = body.year;
    if (year !== undefined && (!Number.isSafeInteger(year) || year < 1900 || year > new Date().getUTCFullYear())) {
      return fail(400,'Invalid year');
    }
    const page = body.page === undefined ? 1 : body.page;
    if (!Number.isSafeInteger(page) || page < 1 || page > 300) return fail(400,'Invalid page');
    const responses = await Promise.all(genre.typeIds.slice(0,5).map(async (typeId) => {
      const url = new URL(source.url);
      url.searchParams.set('ac','videolist');
      url.searchParams.set('t',String(typeId));
      url.searchParams.set('pg',String(page));
      if (year) url.searchParams.set('year',String(year));
      const res = await fetchUpstream(url.href, {timeoutMs:9000,headers:cmsRequestHeaders()});
      if (!res.ok) throw new Error('Source failed (HTTP ' + res.status + ')');
      const json = await res.json() as {pagecount?:unknown;list?:unknown};
      const maxPage = Math.min(300, Math.max(1,Number(json.pagecount)||1));
      return {list:parseSearchList(json,source), pageCount:maxPage};
    }));
    const seen = new Set<string>();
    let list: SearchResultItem[] = responses.flatMap((result)=>result.list).filter((v) => {
      const id = v.sourceKey + ':' + v.vodId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // The year is enforced locally too, because not every Apple CMS provider honors year=.
    if (year) list = list.filter((item)=>item.year === String(year));
    if (genre.adult) list = list.filter((item)=>isAdultCategory(item.typeName || ''));
    else list = filterAdultResults(list,true).filter((item)=>!isAdultCategory(item.typeName || ''));
    return NextResponse.json({
      list, page, pageCount: Math.max(...responses.map((v)=>v.pageCount)),
      genre:genre.label,
    });
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Could not load this genre');
  }
}

import { getCache, setCache, fetchUpstream } from './fetch-utils';
import type { SearchResultItem } from './types';

/** English-only enrichment from Cinemeta. Unmatched values are omitted, never fabricated. */
export interface EnglishMetadata {
  englishTitle?: string;
  englishDescription?: string;
  imdbId?: string;
  imdbRating?: number;
  englishGenre?: string;
  englishRegion?: string;
  englishDirector?: string;
  englishCast?: string;
  runtime?: string;
  trailerUrl?: string;
}
type CatalogEntry = { id?:string; name?:string; releaseInfo?:string; year?:string };
type MovieMeta = {
  name?:string; description?:string; imdbRating?:string | number; director?:string[];
  cast?:string[]; country?:string; genres?:string[]; runtime?:string;
  trailers?:Array<{ source?:string; type?:string }>;
};

const clean = (v:string) => v.toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
const hasLatin = (v:string) => /[a-z]{3}/i.test(v);
const englishOnly = (v:unknown):v is string => typeof v==='string' && hasLatin(v) && !/[\u3400-\u9fff]/u.test(v);
const cacheTtl=6*60*60*1000;

export function englishCandidates(item: Pick<SearchResultItem,'name'|'searchAliases'>):string[] {
  const parts:string[]=[];
  if (englishOnly(item.name)) parts.push(item.name.trim());
  for (const token of (item.searchAliases||'').match(/[A-Za-z][A-Za-z0-9 .:'’!?&()\\-]{2,}/g)||[]) {
    for (const part of token.split(/\s+[|/]\s+|\s{2,}/)) {
      const candidate=part.trim().replace(/^[.,:()\s-]+|[.,:()\s-]+$/g,'');
      if (candidate.length>=4 && englishOnly(candidate)) parts.push(candidate);
    }
  }
  return [...new Set(parts)].slice(0,3);
}


function exactYearMatch(actual:string|undefined,expected:string|undefined):boolean {
  const a=Number((actual||'').match(/\d{4}/)?.[0]);
  const b=Number((expected||'').match(/\d{4}/)?.[0]);
  return !b || !a || Math.abs(a-b)<=1;
}
export function chooseCinemeta(candidates:CatalogEntry[], names:string[], year:string|undefined):CatalogEntry|undefined {
  const normalized=names.map(clean).filter(Boolean);
  return candidates.find((v)=>v.id?.startsWith('tt') && v.name && normalized.includes(clean(v.name)) && exactYearMatch(v.releaseInfo||v.year,year));
}

async function getJson(url:string):Promise<unknown> {
  const response=await fetchUpstream(url,{timeoutMs:6500,headers:{Accept:'application/json','User-Agent':'LibreTV/2.20.1'}});
  if(!response.ok) throw new Error('Metadata provider unavailable');
  return response.json();
}

export async function lookupEnglishMetadata(item:SearchResultItem):Promise<EnglishMetadata> {
  const names=englishCandidates(item);
  const fallback:EnglishMetadata={englishTitle:names[0]};
  if(!names.length) return fallback;
  const key='english-meta:'+names.map(clean).join('|')+':'+(item.year||'');
  const cached=getCache<EnglishMetadata>(key);
  if(cached) return cached;
  let result:EnglishMetadata=fallback;
  try {
    // One verified metadata match; do not mistake a provider vod_score for IMDb.
    for(const name of names.slice(0,2)) {
      const url='https://v3-cinemeta.strem.io/catalog/movie/top/search='+encodeURIComponent(name)+'.json';
      const data=await getJson(url) as {metas?:CatalogEntry[]};
      const chosen=chooseCinemeta(data.metas||[],names,item.year);
      if(!chosen?.id) continue;
      let meta:MovieMeta={};
      try {
        const detail=await getJson('https://v3-cinemeta.strem.io/meta/movie/'+encodeURIComponent(chosen.id)+'.json') as {meta?:MovieMeta};
        meta=detail.meta||{};
      }catch { /* Catalog name is verified even if detail service is temporarily blocked. */ }
      const rating=Number(meta.imdbRating);
      const trailer=meta.trailers?.find(t=>t.type?.toLowerCase()==='trailer' && /^[a-zA-Z0-9_-]{11}$/.test(t.source||''))?.source;
      result={
        englishTitle:englishOnly(meta.name) ? meta.name : chosen.name,
        englishDescription:englishOnly(meta.description) ? meta.description.slice(0,4000) : undefined,
        imdbId:chosen.id,
        imdbRating:meta.imdbRating!=='' && meta.imdbRating!==null && meta.imdbRating!==undefined && Number.isFinite(rating) && rating>=1 && rating<=10 ? rating : undefined,
        englishGenre:Array.isArray(meta.genres)?meta.genres.filter(englishOnly).join(', ') || undefined:undefined,
        englishRegion:englishOnly(meta.country)?meta.country:undefined,
        englishDirector:Array.isArray(meta.director)?meta.director.filter(englishOnly).join(', ')||undefined:undefined,
        englishCast:Array.isArray(meta.cast)?meta.cast.filter(englishOnly).slice(0,18).join(', ')||undefined:undefined,
        runtime:englishOnly(meta.runtime)?meta.runtime:undefined,
        trailerUrl:trailer?'https://www.youtube.com/watch?v='+trailer:undefined,
      };
      break;
    }
  }catch { /* Provider may throttle; show source's English alias, never fake details. */ }
  setCache(key,result,cacheTtl);
  return result;
}

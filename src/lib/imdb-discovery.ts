import { fetchUpstream, getCache, setCache } from './fetch-utils';

export interface ImdbMovie {
  imdbId: string;
  title: string;
  year?: number;
  rating: number;
  poster?: string;
}
export interface ImdbDiscoveryResult {
  movies: ImdbMovie[];
  totalMatches: number;
  pagesChecked: number;
  partial: boolean;
}

const ALLOWED_GENRES = new Set([
  'Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama',
  'Family','Fantasy','History','Horror','Mystery','Romance','Sci-Fi','Sport',
  'Thriller','War','Western',
]);
const CACHE_TTL = 60*60*1000;
const PAGE_OFFSETS = Array.from({length:12},(_,i)=>i*50);

/** The catalog is grouped by movie release recency, not sorted by rating.
 * Read multiple pages before ranking. Catalog titles are NOT proof of source availability.
 */
export async function discoverImdb(genre:string, minRating:number, year?:number):Promise<ImdbDiscoveryResult>{
  if(!ALLOWED_GENRES.has(genre) || !Number.isFinite(minRating) ||
    minRating<1 || minRating>10 || (year!==undefined && (!Number.isSafeInteger(year) || year<1900 || year>new Date().getUTCFullYear()))) {
    throw new Error('Invalid IMDb discovery filters');
  }
  const key='imdb-discover:'+genre+':'+minRating+':'+(year||'all');
  const cached=getCache<ImdbDiscoveryResult>(key);
  if(cached) return cached;
  const pages:(ImdbMovie[])[]=[];
  let failed=0;
  let next=0;
  const worker=async()=>{
    for(;;){
      const at=next++;
      if(at>=PAGE_OFFSETS.length) return;
      const skip=PAGE_OFFSETS[at];
      const url='https://v3-cinemeta.strem.io/catalog/movie/imdbRating/genre='+
        encodeURIComponent(genre)+'&skip='+skip+'.json';
      try {
        const res=await fetchUpstream(url,{timeoutMs:7500,headers:{Accept:'application/json','User-Agent':'LibreTV/2.20.1'}});
        if(!res.ok) throw new Error('Cinemeta returned HTTP '+res.status);
        const payload=await res.json() as {metas?:unknown};
        if(!Array.isArray(payload.metas)) throw new Error('Invalid Cinemeta response');
        const movies:ImdbMovie[]=[];
        for(const raw of payload.metas){
          if(!raw || typeof raw!=='object') continue;
          const m=raw as Record<string,unknown>;
          const id=String(m.id||'');
          const title=String(m.name||'');
          const rating=Number(m.imdbRating);
          const yearText=String(m.releaseInfo||m.year||'');
          const match=yearText.match(/\b(19|20)\d{2}\b/);
          const releaseYear=match?Number(match[0]):undefined;
          if(!/^tt\d{5,12}$/.test(id) || !title || /[\u3400-\u9fff]/u.test(title) ||
            !Number.isFinite(rating) || rating<minRating || rating>10 ||
            (year!==undefined && releaseYear!==year)) continue;
          const poster=typeof m.poster==='string' && /^https:\/\//.test(m.poster) ? m.poster : undefined;
          movies.push({imdbId:id,title:title.slice(0,180),rating,year:releaseYear,poster});
        }
        pages[at]=movies;
      } catch { failed++; }
    }
  };
  await Promise.all(Array.from({length:4},()=>worker()));
  if(failed===PAGE_OFFSETS.length) throw new Error('IMDb discovery service is currently unavailable');
  const seen=new Set<string>();
  const ranked=pages.flatMap(x=>x||[]).filter(m=>{
    if(seen.has(m.imdbId)) return false;
    seen.add(m.imdbId);return true;
  }).sort((a,b)=>b.rating-a.rating || (b.year||0)-(a.year||0) || a.title.localeCompare(b.title));
  const result:ImdbDiscoveryResult={
    movies:ranked.slice(0,120),totalMatches:ranked.length,
    pagesChecked:PAGE_OFFSETS.length-failed,partial:failed>0,
  };
  setCache(key,result,CACHE_TTL);
  return result;
}

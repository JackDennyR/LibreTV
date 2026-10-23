'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SourceConfig, SearchResultItem } from '@/lib/types';
import type { BrowseCategory } from '@/lib/browse-categories';
import { aggregateResults, AggregatedCard } from '@/components/video-card';
import { useEnglishMetadata } from '@/components/use-english-metadata';
import { ImdbDiscoverSection } from '@/components/imdb-discover-section';

interface Props {
  sources: SourceConfig[];
  onOpen: (item: SearchResultItem) => void;
  onFind: (name: string) => void;
}
type BrowseResponse = {list:SearchResultItem[];page:number;pageCount:number;genre:string};
type ActiveBrowse = {source:SourceConfig;genre:string;year?:number;page:number;allowAdult:boolean};

async function browseApi<T>(payload: Record<string,unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch('/api/browse', {
    method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload), signal,
  });
  const body = await res.json() as T & {error?:string};
  if (!res.ok) throw new Error(body.error || 'Cannot load the selected category');
  return body;
}

export function BrowseSection({sources,onOpen,onFind}:Props) {
  const [sourceKey,setSourceKey] = useState('');
  const [genre,setGenre] = useState('');
  const [year,setYear] = useState('');
  const [minRating,setMinRating] = useState('');
  const [adultConfirmed,setAdultConfirmed] = useState(false);
  const [active,setActive] = useState<ActiveBrowse|null>(null);
  const source = useMemo(()=>sources.find((s)=>s.key===sourceKey) || sources[0], [sources,sourceKey]);
  const categories = useQuery({
    queryKey:['browse-categories',source?.url],
    queryFn:({signal})=> browseApi<{genres:BrowseCategory[]}>({action:'categories',source},signal),
    enabled:Boolean(source), staleTime:600_000, retry:1,
  });
  const categoryList=categories.data?.genres || [];
  const chosen=categoryList.find((g)=>g.key===genre);
  useEffect(()=>{setGenre('');setActive(null);setAdultConfirmed(false);},[source?.key]);
  const browse=useQuery({
    queryKey:['browse',active?.source.url,active?.genre,active?.year,active?.page,active?.allowAdult],
    queryFn:({signal})=>browseApi<BrowseResponse>({
      action:'browse',source:active!.source,genre:active!.genre,year:active!.year,
      page:active!.page,allowAdult:active!.allowAdult,
    },signal),
    enabled:Boolean(active),retry:1,
  });
  const rawItems=useMemo(()=>browse.data?.list || [],[browse.data]);
  const english=useEnglishMetadata(rawItems);
  const ratedItems=useMemo(()=>english.items.filter((item)=>!minRating || (item.imdbRating!==undefined && item.imdbRating>=Number(minRating))),[english.items,minRating]);
  const grouped=useMemo(()=>aggregateResults(ratedItems),[ratedItems]);
  const years=useMemo(()=>Array.from({length:new Date().getFullYear()-1949},(_,i)=>new Date().getFullYear()-i),[]);
  const selectGenre=(key:string)=>{
    if (key==='adult' && !adultConfirmed) {
      const confirmed=window.confirm('18+ category: Confirm that you are at least 18 years old and want to view adult-rated content. This choice applies only to this browse session.');
      if(!confirmed) return;
      setAdultConfirmed(true);
    }
    setGenre(key);
    setActive(null);
  };
  const apply=()=>{
    if(!source || !chosen) return;
    setActive({source,genre:chosen.key,year:year?Number(year):undefined,page:1,allowAdult:chosen.adult && adultConfirmed});
  };
  return (
    <section aria-label="Browse movies by genre" className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-content">Browse by genre</h2>
          <p className="text-xs text-muted mt-1">Filter the source catalog by category and release year.</p>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
          <label className="block text-xs text-muted">
            Source
            <select aria-label="Browse source" value={source?.key || ''} onChange={(e)=>setSourceKey(e.target.value)}
              className="w-full mt-1 rounded-lg border border-line bg-chip text-content px-3 py-2.5 text-sm">
              {sources.map((s)=><option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Genre
            <select aria-label="Genre" value={genre} onChange={(e)=>selectGenre(e.target.value)}
              disabled={!source || categories.isPending}
              className="w-full mt-1 rounded-lg border border-line bg-chip text-content px-3 py-2.5 text-sm">
              <option value="">Choose genre</option>
              {categoryList.map((cat)=><option key={cat.key} value={cat.key}>{cat.label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Release year
            <select aria-label="Release year" value={year} onChange={(e)=>{setYear(e.target.value);setActive(null);}}
              className="w-full mt-1 rounded-lg border border-line bg-chip text-content px-3 py-2.5 text-sm">
              <option value="">All years</option>
              {years.map((y)=><option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Minimum IMDb
            <select aria-label="Minimum IMDb rating" value={minRating} onChange={(e)=>setMinRating(e.target.value)}
              className="w-full mt-1 rounded-lg border border-line bg-chip text-content px-3 py-2.5 text-sm">
              <option value="">Any rating</option>
              {[5,6,7,8,9].map((v)=><option key={v} value={v}>{v}.0+</option>)}
            </select>
          </label>
          <button type="button" onClick={apply} disabled={!chosen || browse.isFetching}
            className="btn-primary !rounded-lg px-4 py-2.5 text-sm disabled:opacity-50">
            {browse.isFetching ? 'Loading…' : 'Browse'}
          </button>
        </div>
        {categories.isError && <p role="alert" className="mt-3 text-xs text-warning">{categories.error.message}</p>}
        {chosen?.adult && (
          <p className="mt-3 text-xs text-warning">
            18+ is opt-in for this browsing session. Your regular content-filter settings are unchanged.
          </p>
        )}
      </div>
      {active && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-medium text-content text-sm">{chosen?.label || browse.data?.genre}{active.year ? ' · '+active.year : ''}</h3>
            {browse.data && <span className="text-xs text-muted">Page {browse.data.page} of {browse.data.pageCount}</span>}
          </div>
          {english.loading && <p className="text-xs text-muted mb-3">Checking English titles and IMDb ratings…</p>}
          {minRating && <p className="text-xs text-faint mb-3">Playable source results below are checked only on this source page. The IMDb discovery list further down checks a broader movie catalog, but does not guarantee the source has each movie.</p>}
          {browse.isPending || browse.isFetching && !browse.data ? (
            <p className="text-muted text-sm py-6">Loading titles…</p>
          ) : browse.isError ? (
            <div className="text-warning text-sm py-4" role="alert">
              {browse.error.message}
              <button type="button" className="btn-ghost btn-sm ml-2" onClick={()=>void browse.refetch()}>Retry</button>
            </div>
          ) : grouped.length===0 ? (
            <p className="text-muted text-sm py-5">No verified rated matches on this source page. This does not mean the full catalog has none; see IMDb discovery below or continue browsing source pages.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                {grouped.map((group)=><AggregatedCard key={group.key} group={group} sources={[active.source]} onOpen={onOpen}/>)}
              </div>
              <div className="flex justify-center gap-3 mt-4">
                <button type="button" className="btn-ghost btn-sm" disabled={active.page<=1 || browse.isFetching}
                  onClick={()=>setActive({...active,page:active.page-1})}>Previous</button>
                <button type="button" className="btn-ghost btn-sm" disabled={active.page >= (browse.data?.pageCount || 1) || browse.isFetching}
                  onClick={()=>setActive({...active,page:active.page+1})}>Next page</button>
              </div>
            </>
          )}
          {minRating && <ImdbDiscoverSection
            genre={categoryList.find((c)=>c.key===active.genre)?.label || ''}
            minRating={Number(minRating)} year={active.year}
            sourceName={active.source.name} onFind={onFind}
          />}
        </div>
      )}
    </section>
  );
}

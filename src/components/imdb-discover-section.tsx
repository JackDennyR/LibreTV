'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SmartImage } from './smart-image';
import { useAppStore } from '@/lib/store';
import type { ImdbDiscoveryResult } from '@/lib/imdb-discovery';

const AVAILABLE_GENRES = new Set(['Action','Adventure','Animation','Biography','Comedy',
  'Crime','Documentary','Drama','Family','Fantasy','History','Horror','Mystery',
  'Romance','Sci-Fi','Sport','Thriller','War','Western']);

export function ImdbDiscoverSection({
  genre, minRating, year, sourceName, onFind,
}:{
  genre:string; minRating:number; year?:number; sourceName:string;
  onFind:(title:string)=>void;
}) {
  const [visible,setVisible]=useState(24);
  const imageProxyMode=useAppStore(s=>s.imageProxyMode);
  const customImageProxy=useAppStore(s=>s.customImageProxy);
  const supported=AVAILABLE_GENRES.has(genre);
  const result=useQuery({
    queryKey:['imdb-discover',genre,minRating,year],
    enabled:supported,
    staleTime:60*60*1000,retry:1,
    queryFn:async({signal}):Promise<ImdbDiscoveryResult>=>{
      const res=await fetch('/api/imdb-discover',{method:'POST',
        credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({genre,minRating,year}),signal});
      if(!res.ok) throw new Error('IMDb discovery is temporarily unavailable');
      return res.json() as Promise<ImdbDiscoveryResult>;
    },
  });
  if(!supported) return null;
  const matches=result.data?.movies||[];
  return (
    <section aria-label="IMDb movie discovery" className="mt-7 pt-5 border-t border-line">
      <h3 className="font-semibold text-content text-base mb-1">
        IMDb-rated {genre} movies {year ? '('+year+')' : ''}
      </h3>
      <p className="text-xs text-muted mb-4">
        Browse IMDb-rated titles across Cinemeta, not just the latest page from {sourceName}.
        Availability on {sourceName} is <strong>not verified</strong>. Search your source to check whether a movie can be watched.
      </p>
      {result.isPending ? <p className="text-sm text-muted py-5">Finding IMDb-rated movies across the catalog…</p>
      : result.isError ? <p role="alert" className="text-sm text-warning py-4">
          IMDb discovery is temporarily unavailable.
          <button type="button" className="btn-ghost btn-sm ml-2" onClick={()=>void result.refetch()}>Retry</button>
        </p>
      : <>
        {result.data?.partial && <p className="text-xs text-warning mb-3">
          The movie catalog was partially unavailable. These are verified partial results.
        </p>}
        <p className="text-xs text-faint mb-3">
          {result.data?.totalMatches||0} IMDb titles rated {minRating.toFixed(1)}+ in the checked catalog.
          These are not confirmed streaming results.
        </p>
        {matches.length===0
          ? <p className="text-sm text-muted py-3">No titles with verified IMDb ratings meet these filters in the checked catalog.</p>
          : <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.slice(0,visible).map(movie=>(
                <article key={movie.imdbId} className="flex gap-3 rounded-xl border border-line bg-surface-raised p-3 min-w-0">
                  {movie.poster && (
                    <SmartImage url={movie.poster} mode={imageProxyMode} customProxy={customImageProxy}
                      alt={movie.title+' poster'} className="w-16 h-24 object-cover rounded bg-chip shrink-0"/>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-content line-clamp-2" title={movie.title}>{movie.title}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs mt-1">
                      <span className="tag bg-amber-500/15 text-amber-300">IMDb {movie.rating.toFixed(1)}</span>
                      {movie.year && <span className="text-muted">{movie.year}</span>}
                    </div>
                    <div className="mt-auto pt-2 flex gap-2 items-center flex-wrap">
                      <button type="button" className="btn-primary btn-sm !rounded-md"
                        onClick={()=>onFind(movie.title)}>Search {sourceName}</button>
                      <a className="text-xs text-accent underline" target="_blank" rel="noopener noreferrer"
                        href={'https://www.imdb.com/title/'+movie.imdbId+'/'}>IMDb</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {matches.length>visible && <div className="flex justify-center mt-4">
              <button className="btn-ghost btn-sm" type="button" onClick={()=>setVisible(v=>v+24)}>
                Show more IMDb movies ({matches.length-visible} remaining)
              </button>
            </div>}
          </>
        }
      </>}
    </section>
  );
}

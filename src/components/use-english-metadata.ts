'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SearchResultItem } from '@/lib/types';
import type { EnglishMetadata } from '@/lib/movie-metadata';
type Batch={items:Record<string,EnglishMetadata>};

export function useEnglishMetadata(items:SearchResultItem[]) {
  const inputs=useMemo(()=>items.slice(0,30).map((item)=>({
    sourceKey:item.sourceKey,vodId:item.vodId,name:item.name,
    searchAliases:item.searchAliases,year:item.year,
  })),[items]);
  const query=useQuery({
    queryKey:['english-metadata',inputs.map(i=>[i.sourceKey,i.vodId,i.name,i.searchAliases,i.year])],
    queryFn:async({signal}):Promise<Batch>=>{
      const res=await fetch('/api/movie-metadata',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({items:inputs}),signal});
      if(!res.ok) throw new Error('English movie details temporarily unavailable');
      return res.json() as Promise<Batch>;
    },
    staleTime:30*60_000,enabled:inputs.length>0,retry:0,
  });
  const enriched=useMemo(()=>items.map((item)=>{
    const meta=query.data?.items?.[item.sourceKey+':'+item.vodId];
    return meta?{...item,...meta}:item;
  }),[items,query.data]);
  return {items:enriched,loading:query.isPending&&inputs.length>0,firstPageCount:inputs.length,error:query.isError?query.error.message:undefined};
}

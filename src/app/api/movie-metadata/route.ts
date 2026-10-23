import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { lookupEnglishMetadata } from '@/lib/movie-metadata';
import type { SearchResultItem } from '@/lib/types';

export const runtime='nodejs';
export async function POST(req:Request) {
  const forbidden=guardRequest(req);
  if(forbidden) return forbidden;
  let items:SearchResultItem[];
  try {
    const body=await req.json() as {items?:SearchResultItem[]};
    if(!Array.isArray(body.items)||body.items.length===0||body.items.length>30) throw Error();
    items=body.items;
    if(items.some(x=>!x || typeof x.name!=='string' || x.name.length>200 ||
      typeof x.vodId!=='string'||x.vodId.length>100||
      typeof x.sourceKey!=='string'||x.sourceKey.length>100||
      (x.searchAliases && (typeof x.searchAliases!=='string'||x.searchAliases.length>1024)))) throw Error();
  }catch {return NextResponse.json({error:'Invalid metadata request (maximum 30 titles)'},{status:400});}
  const enriched:Record<string, Awaited<ReturnType<typeof lookupEnglishMetadata>>>={};
  let next=0;
  // Cap per-request traffic; cached titles cost no extra provider requests.
  await Promise.all(Array.from({length:Math.min(5,items.length)},async()=>{
    for(;;){
      const i=next++;
      if(i>=items.length) return;
      const entry=items[i];
      try {enriched[entry.sourceKey+':'+entry.vodId]=await lookupEnglishMetadata(entry);}
      catch {enriched[entry.sourceKey+':'+entry.vodId]={};}
    }
  }));
  return NextResponse.json({items:enriched});
}

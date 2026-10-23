import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { discoverImdb } from '@/lib/imdb-discovery';
export const runtime='nodejs';
export async function POST(req:Request) {
  const denied=guardRequest(req);
  if(denied) return denied;
  let body:{genre?:unknown;minRating?:unknown;year?:unknown};
  try{body=await req.json() as typeof body;}catch{
    return NextResponse.json({error:'Invalid JSON request'},{status:400});
  }
  const genre=body?.genre;
  const minRating=body?.minRating;
  const year=body?.year;
  if(typeof genre!=='string'||genre.length>60||typeof minRating!=='number'||
    (year!==undefined && typeof year!=='number')) {
    return NextResponse.json({error:'Invalid IMDb discovery filters'},{status:400});
  }
  try{
    return NextResponse.json(await discoverImdb(genre,minRating,year as number|undefined));
  }catch(error){
    const invalid=error instanceof Error && error.message==='Invalid IMDb discovery filters';
    return NextResponse.json({error:invalid?'Invalid IMDb discovery filters':'IMDb discovery service temporarily unavailable'},
      {status:invalid?400:502});
  }
}

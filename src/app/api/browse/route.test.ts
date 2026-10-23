import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

const {mockFetch,mockCache} = vi.hoisted(()=>({mockFetch:vi.fn(),mockCache:new Map<string,unknown>()}));
vi.mock('@/lib/ssrf',()=>({checkUpstreamAllowed:vi.fn(async()=>({ok:true}))}));
vi.mock('@/lib/fetch-utils',()=>({
  fetchUpstream:mockFetch,
  getCache:(k:string)=>mockCache.get(k),
  setCache:(k:string,v:unknown)=>{mockCache.set(k,v);},
}));
const source={key:'bfzy',name:'BFZY',url:'https://cms.example.test/api.php/provide/vod'};
const classes={class:[{type_id:21,type_name:'动作片'},{type_id:29,type_name:'理论片'},{type_id:73,type_name:'福利'}]};
const list=(items:object[])=>new Response(JSON.stringify({code:1,list:items,pagecount:2}),{status:200});
const movie=(id:number,type_name:string,year:string)=>({vod_id:id,vod_name:'Film '+id,type_name,vod_year:year});
beforeAll(()=>{process.env.PASSWORD='test-password';});
beforeEach(()=>{
  mockCache.clear(); mockFetch.mockReset();
  mockFetch.mockImplementation(async(url:string)=>{
    const parsed=new URL(url);
    if(parsed.searchParams.get('ac')==='list') return new Response(JSON.stringify(classes));
    if(parsed.searchParams.get('t')==='21') return list([
      movie(10,'动作片','2025'),movie(11,'动作片','2023'),movie(12,'理论片','2025'),
    ]);
    return list([movie(100,'理论片','2025')]);
  });
});
function req(body:object,loggedIn=true){
  const {token}=signSession();
  return new Request('https://site.example/api/browse',{
    method:'POST',
    headers:{'Content-Type':'application/json',...(loggedIn?{Cookie:SESSION_COOKIE+'='+token}:{})},
    body:JSON.stringify({...body,source}),
  });
}
describe('POST /api/browse',()=>{
  it('requires a valid logged-in session',async()=>{
    expect((await POST(req({action:'categories'},false))).status).toBe(401);
  });
  it('fetches server source taxonomy, translating genres and grouping 18+',async()=>{
    const res=await POST(req({action:'categories'}));
    const out=await res.json();
    expect(res.status).toBe(200);
    expect(out.genres).toContainEqual({key:'action',label:'Action',adult:false,typeIds:[21]});
    expect(out.genres).toContainEqual({key:'adult',label:'18+',adult:true,typeIds:[29,73]});
  });
  it('applies year and excludes adult content from regular genres even if a source mixes results',async()=>{
    const res=await POST(req({action:'browse',genre:'action',year:2025,page:1}));
    const out=await res.json();
    expect(res.status).toBe(200);
    expect(out.list.map((r:{vodId:string})=>r.vodId)).toEqual(['10']);
    expect(mockFetch.mock.calls.some((call: unknown[])=>new URL(String(call[0])).searchParams.get('year')==='2025')).toBe(true);
  });
  it('requires explicit 18+ opt-in and returns only adult category titles',async()=>{
    expect((await POST(req({action:'browse',genre:'adult'}))).status).toBe(403);
    const res=await POST(req({action:'browse',genre:'adult',allowAdult:true}));
    const out=await res.json();
    expect(res.status).toBe(200);
    expect(out.list.map((r:{vodId:string})=>r.vodId)).toEqual(['100']);
  });
  it('rejects invalid years and unknown categories',async()=>{
    expect((await POST(req({action:'browse',genre:'action',year:3000}))).status).toBe(400);
    expect((await POST(req({action:'browse',genre:'fake'}))).status).toBe(400);
    expect((await POST(req({action:'browse',genre:'action',allowAdult:true}))).status).toBe(400);
  });
});

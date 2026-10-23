import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from './route';
import {SESSION_COOKIE,signSession} from '@/lib/auth';
const {discover}=vi.hoisted(()=>({discover:vi.fn()}));
vi.mock('@/lib/imdb-discovery',()=>({discoverImdb:discover}));
beforeAll(()=>{process.env.PASSWORD='test-secret';});
beforeEach(()=>{discover.mockReset().mockResolvedValue({movies:[{imdbId:'tt0078748',title:'Alien',rating:8.4}],pagesChecked:12,partial:false,totalMatches:1});});
const request=(body:unknown,auth=true)=>{
 const {token}=signSession();
 return new Request('https://app.example/api/imdb-discover',{
  method:'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:SESSION_COOKIE+'='+token}:{})},
  body:JSON.stringify(body),
 });
};
describe('IMDb discovery endpoint',()=>{
 it('blocks requests without password session',async()=>{
  expect((await POST(request({genre:'Horror',minRating:8},false))).status).toBe(401);
  expect(discover).not.toHaveBeenCalled();
 });
 it('returns IMDb metadata with provider coverage from a valid request',async()=>{
  const response=await POST(request({genre:'Horror',minRating:8}));
  expect(response.status).toBe(200);
  expect((await response.json()).movies[0].title).toBe('Alien');
  expect(discover).toHaveBeenCalledWith('Horror',8,undefined);
 });
 it('rejects invalid fields',async()=>{
  expect((await POST(request({genre:'Horror',minRating:'8'}))).status).toBe(400);
  expect(discover).not.toHaveBeenCalled();
 });
 it('uses a generic upstream failure response without exposing internals',async()=>{
  discover.mockRejectedValueOnce(new Error('private provider failure'));
  const res=await POST(request({genre:'Horror',minRating:8}));
  expect(res.status).toBe(502);
  expect((await res.json()).error).toBe('IMDb discovery service temporarily unavailable');
 });
});

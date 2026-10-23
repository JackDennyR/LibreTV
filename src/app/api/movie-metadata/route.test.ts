import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from './route';
import {SESSION_COOKIE,signSession} from '@/lib/auth';
const {lookup}=vi.hoisted(()=>({lookup:vi.fn()}));
vi.mock('@/lib/movie-metadata',()=>({lookupEnglishMetadata:lookup}));
beforeAll(()=>{process.env.PASSWORD='test-secret';});
beforeEach(()=>{lookup.mockReset();lookup.mockResolvedValue({englishTitle:'By Any Means',imdbRating:8.2});});
const item={sourceKey:'bfzy',vodId:'168644',name:'不择手段',searchAliases:'By Any Means',year:'2026'};
function request(body:unknown,auth=true){
 const {token}=signSession();
 return new Request('https://libretv.test/api/movie-metadata',{
  method:'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:SESSION_COOKIE+'='+token}:{})},
  body:JSON.stringify(body),
 });
}
describe('English metadata endpoint',()=>{
 it('requires authentication',async()=>{
  const res=await POST(request({items:[item]},false));
  expect(res.status).toBe(401);
  expect(lookup).not.toHaveBeenCalled();
 });
 it('returns ID-keyed verified metadata for a requested movie',async()=>{
  const res=await POST(request({items:[item]}));
  const body=await res.json();
  expect(res.status).toBe(200);
  expect(body.items['bfzy:168644']).toEqual({englishTitle:'By Any Means',imdbRating:8.2});
 });
 it('bounds batch requests and rejects oversized inputs',async()=>{
  const res=await POST(request({items:Array.from({length:31},()=>item)}));
  expect(res.status).toBe(400);
  expect(lookup).not.toHaveBeenCalled();
 });
 it('survives metadata provider failure with a blank record',async()=>{
  lookup.mockRejectedValueOnce(new Error('provider unavailable'));
  const res=await POST(request({items:[item]}));
  const body=await res.json();
  expect(res.status).toBe(200);
  expect(body.items['bfzy:168644']).toEqual({});
 });
});

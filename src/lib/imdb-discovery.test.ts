import {beforeEach,describe,expect,it,vi} from 'vitest';
import {discoverImdb} from './imdb-discovery';
const {upstream,cache}=vi.hoisted(()=>({upstream:vi.fn(),cache:new Map<string,unknown>()}));
vi.mock('./fetch-utils',()=>({
  fetchUpstream:upstream,
  getCache:(key:string)=>cache.get(key),
  setCache:(key:string,value:unknown)=>{cache.set(key,value);},
}));
beforeEach(()=>{upstream.mockReset();cache.clear();});
describe('IMDb discovery beyond the first provider page',()=>{
 it('scans all the Cinemeta genre catalog offsets and ranks rated classics across releases',async()=>{
  upstream.mockImplementation(async(url:string)=>{
    const skip=Number(new URL(url).pathname.match(/skip=(\d+)\.json/)?.[1]||0);
    const titles=skip===350
      ? [{id:'tt0215893',name:'The Silence of the Lambs',imdbRating:'8.6',releaseInfo:'1991'}]
      : skip===400
      ? [{id:'tt0078748',name:'Alien',imdbRating:'8.4',releaseInfo:'1979'},
         {id:'tt0084787',name:'The Thing',imdbRating:'8.2',releaseInfo:'1982'}]
      : [{id:'ttbad',name:'Recent horror',imdbRating:'5.8',releaseInfo:'2026'}];
    return new Response(JSON.stringify({metas:titles}),{status:200});
  });
  const found=await discoverImdb('Horror',8);
  expect(found.movies.map(x=>x.title)).toEqual(['The Silence of the Lambs','Alien','The Thing']);
  expect(found.movies[0].rating).toBe(8.6);
  expect(found.pagesChecked).toBe(12);
  expect(found.partial).toBe(false);
  expect(upstream).toHaveBeenCalledTimes(12);
  expect((await discoverImdb('Horror',8)).totalMatches).toBe(3);
  expect(upstream).toHaveBeenCalledTimes(12);
 });
 it('filters verified release year and omits records without an IMDb rating',async()=>{
  upstream.mockResolvedValue(new Response(JSON.stringify({metas:[
    {id:'tt0078748',name:'Alien',imdbRating:'8.4',releaseInfo:'1979'},
    {id:'tt0084787',name:'The Thing',imdbRating:'8.2',releaseInfo:'1982'},
    {id:'tt0080088',name:'Unrated',imdbRating:'',releaseInfo:'1979'},
  ]}),{status:200}));
  const result=await discoverImdb('Horror',8,1979);
  expect(result.movies).toEqual([{imdbId:'tt0078748',title:'Alien',year:1979,rating:8.4,poster:undefined}]);
 });
 it('returns partial results when some catalog pages fail, without silently presenting complete coverage',async()=>{
  upstream.mockImplementation(async(url:string)=>{
    if(url.includes('skip=50.json')) throw new Error('provider down');
    return new Response(JSON.stringify({metas:[{id:'tt0078748',name:'Alien',imdbRating:'8.4',releaseInfo:'1979'}]}));
  });
  const result=await discoverImdb('Horror',8);
  expect(result.partial).toBe(true);
  expect(result.pagesChecked).toBe(11);
  expect(result.movies).toHaveLength(1);
 });
 it('rejects malformed genre, rating and year',async()=>{
  await expect(discoverImdb('18+',8)).rejects.toThrow('Invalid IMDb discovery filters');
  await expect(discoverImdb('Horror',99)).rejects.toThrow('Invalid IMDb discovery filters');
  await expect(discoverImdb('Horror',8,3000)).rejects.toThrow('Invalid IMDb discovery filters');
  expect(upstream).not.toHaveBeenCalled();
 });
});

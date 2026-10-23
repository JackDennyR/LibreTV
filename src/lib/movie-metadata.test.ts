import {beforeEach,describe,expect,it,vi} from 'vitest';
import {englishRegionFromChinese} from './english-display';
import {chooseCinemeta, englishCandidates, lookupEnglishMetadata} from './movie-metadata';

const {upstream, cache}=vi.hoisted(()=>({upstream:vi.fn(),cache:new Map<string,unknown>()}));
vi.mock('./fetch-utils',()=>({
  fetchUpstream:upstream,
  getCache:(key:string)=>cache.get(key),
  setCache:(key:string,v:unknown)=>{cache.set(key,v);},
}));
const item=(searchAliases:string,year='2026')=>({
  name:'不择手段', searchAliases,year,sourceKey:'bfzy',sourceName:'BFZY',vodId:'168644',
});
beforeEach(()=>{upstream.mockReset();cache.clear();});
describe('English movie metadata matching',()=>{
 it('extracts English aliases without treating pinyin or Chinese text as English',()=>{
  expect(englishCandidates(item('By Any Means'))).toEqual(['By Any Means']);
  expect(englishCandidates(item('二郎神  Jack Reacher 2  更多'))).toEqual(['Jack Reacher 2']);
  expect(englishCandidates(item('纯中文别名'))).toEqual([]);
 });
 it('refuses similarly named movies and wrong years',()=>{
  const metas=[
   {id:'ttwrong',name:'By Any Means',releaseInfo:'2017'},
   {id:'ttother',name:'By Any Means Necessary',releaseInfo:'2026'},
   {id:'tt34379051',name:'By Any Means',releaseInfo:'2026'},
  ];
  expect(chooseCinemeta(metas,['By Any Means'],'2026')?.id).toBe('tt34379051');
  expect(chooseCinemeta(metas.slice(0,2),['By Any Means'],'2026')).toBeUndefined();
 });
 it('returns verified English plot, director, IMDb ID and actual YouTube trailer ID',async()=>{
  upstream.mockResolvedValueOnce(new Response(JSON.stringify({metas:[
   {id:'tt34379051',name:'By Any Means',releaseInfo:'2026'},
  ]}))).mockResolvedValueOnce(new Response(JSON.stringify({meta:{
   name:'By Any Means',description:'An FBI agent investigates a series of murders.',
   cast:['Mark Wahlberg','Yahya Abdul-Mateen II'],director:['Elegance Bratton'],
   imdbRating:'7.8',country:'United States',genres:['Action','Crime'],runtime:'107 min',
   trailers:[{source:'fvnyrBnUx4E',type:'Trailer'}],
  }})));
  const result=await lookupEnglishMetadata(item('By Any Means'));
  expect(result).toMatchObject({
   englishTitle:'By Any Means',englishDescription:'An FBI agent investigates a series of murders.',
   imdbId:'tt34379051',imdbRating:7.8,englishDirector:'Elegance Bratton',
   trailerUrl:'https://www.youtube.com/watch?v=fvnyrBnUx4E',
  });
  expect((await lookupEnglishMetadata(item('By Any Means'))).imdbRating).toBe(7.8);
  expect(upstream).toHaveBeenCalledTimes(2);
 });
 it('does not invent a rating or trailer when metadata has none',async()=>{
  upstream.mockResolvedValueOnce(new Response(JSON.stringify({metas:[{id:'tt34379051',name:'By Any Means',releaseInfo:'2026'}]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({meta:{name:'By Any Means',imdbRating:'',trailers:[]}})));
  const result=await lookupEnglishMetadata(item('By Any Means'));
  expect(result.imdbRating).toBeUndefined();
  expect(result.trailerUrl).toBeUndefined();
 });
 it('translates country names without inventing a translation for unknown credits',()=>{
  expect(englishRegionFromChinese('英国')).toBe('United Kingdom');
  expect(englishRegionFromChinese('美国')).toBe('United States');
  expect(englishRegionFromChinese('火星')).toBeUndefined();
 });
});

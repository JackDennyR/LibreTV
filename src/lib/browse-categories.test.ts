import { describe, expect, it } from 'vitest';
import { categoriesFromCms, isAdultCategory, matchesGenre } from './browse-categories';
describe('Apple CMS category mapping', () => {
  const classes = {class:[
    {type_id:20,type_name:'电影片',type_pid:0},
    {type_id:21,type_name:'动作片',type_pid:20},
    {type_id:22,type_name:'喜剧片',type_pid:20},
    {type_id:24,type_name:'科幻片',type_pid:20},
    {type_id:29,type_name:'理论片',type_pid:20},
    {type_id:73,type_name:'福利',type_pid:0},
    {type_id:39,type_name:'动漫片',type_pid:0},
  ]};
  it('translates available source genres into English and groups 18+ categories',()=>{
    const genres=categoriesFromCms(classes);
    expect(genres.find(g=>g.label==='Action')?.typeIds).toEqual([21]);
    expect(genres.find(g=>g.label==='Comedy')?.typeIds).toEqual([22]);
    expect(genres.find(g=>g.label==='Sci-Fi')?.typeIds).toEqual([24]);
    expect(genres.find(g=>g.label==='18+')).toEqual({label:'18+',key:'adult',adult:true,typeIds:[29,73]});
    expect(genres.at(-1)?.label).toBe('18+');
  });
  it('never interprets adult classes as standard movie genres',()=>{
    expect(isAdultCategory('理论片')).toBe(true);
    expect(isAdultCategory('伦理片')).toBe(true);
    expect(isAdultCategory('福利')).toBe(true);
    expect(isAdultCategory('动作片')).toBe(false);
    expect(matchesGenre('动作片','action')).toBe(true);
    expect(matchesGenre('理论片','adult')).toBe(true);
    expect(matchesGenre('理论片','action')).toBe(false);
  });
  it('ignores invalid categories and does not crash on malformed provider data',()=>{
    expect(categoriesFromCms({class:'not-array'})).toEqual([]);
    expect(categoriesFromCms({class:[null,{type_id:-1,type_name:'Movie'},{type_id:9,type_name:'Other'}]})).toHaveLength(1);
  });
});

import { isAdultContent } from './cms-parser';
export interface BrowseCategory { key: string; label: string; typeIds: number[]; adult: boolean }
const translations: [RegExp,string][] = [
  [/动作/,'Action'],[/喜剧/,'Comedy'],[/剧情/,'Drama'],[/科幻/,'Sci-Fi'],
  [/恐怖|惊悚/,'Horror'],[/爱情/,'Romance'],[/战争/,'War'],[/纪录/,'Documentary'],
  [/动画/,'Animation'],[/动漫/,'Anime'],[/悬疑/,'Mystery'],[/犯罪/,'Crime'],
  [/奇幻|魔幻/,'Fantasy'],[/冒险/,'Adventure'],[/家庭/,'Family'],[/历史/,'History'],
  [/电影片|电影$/,'Movies'],[/连续剧/,'TV Series'],[/国产剧/,'Chinese TV'],
  [/欧美剧/,'Western TV'],[/香港剧/,'Hong Kong TV'],[/韩国剧/,'Korean TV'],
  [/台湾剧/,'Taiwanese TV'],[/日本剧/,'Japanese TV'],[/海外剧/,'International TV'],
  [/泰国剧/,'Thai TV'],[/综艺/,'Variety Shows'],[/短剧/,'Short Dramas'],
  [/体育赛事/,'Sports'],[/足球/,'Football'],[/篮球/,'Basketball'],
  [/网球/,'Tennis'],[/预告/,'Trailers'],
];
export const isAdultCategory = (name: string) =>
  /理论|倫理|伦理|福利|成人|情色|色情|无码|里番/i.test(name) || isAdultContent(name);
const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function categoriesFromCms(data: unknown): BrowseCategory[] {
  const raw = (data as { class?: unknown } | null)?.class;
  if (!Array.isArray(raw)) return [];
  const groups = new Map<string, BrowseCategory>();
  for (const item of raw.slice(0,300)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string,unknown>;
    const id = Number(row.type_id), name = String(row.type_name || '').trim();
    if (!Number.isSafeInteger(id) || id < 1 || !name) continue;
    const adult = isAdultCategory(name);
    const label = adult ? '18+' : translations.find(([r])=>r.test(name))?.[1] || name.slice(0,40);
    const key = adult ? 'adult' : keyOf(label) || String(id);
    const found = groups.get(key);
    if (found) { if(!found.typeIds.includes(id)) found.typeIds.push(id); }
    else groups.set(key,{key,label,typeIds:[id],adult});
  }
  const priority = ['Action','Comedy','Drama','Sci-Fi','Horror','Romance','War','Documentary','Animation','Anime','Movies','TV Series'];
  return [...groups.values()].sort((a,b)=>{
    if (a.adult !== b.adult) return a.adult ? 1 : -1;
    const ai = priority.indexOf(a.label), bi = priority.indexOf(b.label);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
    return a.label.localeCompare(b.label,'en');
  });
}
export function matchesGenre(name: string|undefined, genre: string): boolean {
  if (!name) return false;
  if (genre === 'adult') return isAdultCategory(name);
  const label = translations.find(([r])=>r.test(name))?.[1] || name;
  return keyOf(label) === genre;
}

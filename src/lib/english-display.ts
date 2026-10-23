export function englishRegionFromChinese(value:string|undefined):string|undefined {
  if (!value) return undefined;
  const entries:[RegExp,string][]=[
    [/英国/, 'United Kingdom'],[/美国/, 'United States'],[/中国大陆|大陆/, 'China'],
    [/中国香港|香港/, 'Hong Kong'],[/中国台湾|台湾/, 'Taiwan'],
    [/日本/, 'Japan'],[/韩国/, 'South Korea'],[/法国/, 'France'],
    [/德国/, 'Germany'],[/加拿大/, 'Canada'],[/澳大利亚/, 'Australia'],
    [/印度/, 'India'],[/泰国/, 'Thailand'],[/西班牙/, 'Spain'],
    [/意大利/, 'Italy'],[/俄罗斯/, 'Russia'],
  ];
  if (/[A-Za-z]{3}/.test(value) && !/[\u3400-\u9fff]/u.test(value)) return value.trim();
  return entries.find(([rx])=>rx.test(value))?.[1];
}


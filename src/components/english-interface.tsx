'use client';

import { useEffect } from 'react';

// Local-only translation layer for the LibreTV interface.
// Intentionally leaves movie titles, descriptions and provider metadata untouched.
const pairs = "直播|Live TV\n关于|About\n设置|Settings\n观看历史|Watch History\n下载管理|Downloads\n电影|Movies\n剧集|TV Series\n搜索|Search\n热门|Popular\n最新|Latest\n经典|Classics\n豆瓣高分|Top Rated\n冷门佳片|Hidden Gems\n华语|Chinese\n欧美|Western\n韩国|Korean\n日本|Japanese\n动画|Animation\n美剧|US Series\n英剧|UK Series\n韩剧|Korean Series\n日剧|Japanese Series\n国产剧|Chinese Series\n港剧|Hong Kong Series\n日本动画|Anime\n综艺|Variety\n纪录片|Documentaries\n全部|All\n收藏|Favorites\n最近|Recent\n默认|Default\n名称|Name\n分组|Group\n可用优先|Available First\n最近看|Recently Watched\n全部分组|All Groups\n取消|Cancel\n确认|Confirm\n关闭|Close\n编辑|Edit\n删除|Delete\n添加|Add\n更新|Update\n复制|Copy\n清空|Clear\n清除|Clear\n重试|Retry\n返回|Back\n回首页|Home\n登录|Sign In\n登出|Sign Out\n密码|Password\n访问验证|Access Verification\n请输入密码继续访问|Enter the password to continue\n进入|Continue\n验证中...|Verifying...\n验证成功|Verified\n验证失败|Verification Failed\n密码错误|Incorrect Password\n已退出登录|Signed out\n需要登录|Login required\n需要配置密码|Password Not Configured\n搜索影片|Search Movies\n搜索影片...|Search for a movie or series...\n输入影片名称...|Search for a movie or series...\n搜索结果|Search Results\n请输入搜索内容|Enter a search query\n搜索观看历史|Search Watch History\n搜索观看历史...|Search watch history...\n搜索频道 / tvg-id / 分组...|Search channels, ID, or group...\n搜索名称或地址|Search by name or URL\n最近搜索|Recent Searches\n清空搜索|Clear Search\n清空历史|Clear History\n清空全部观看历史？|Clear all watch history?\n暂无观看记录|No Watch History\n清空搜索记录|Clear Search History\n源管理|Sources\n偏好设置|Preferences\n数据|Data\n点播源|Movie Sources\n直播源|Live TV Sources\n数据源订阅|Source Subscriptions\n播放与过滤|Playback & Filtering\n封面图加载|Poster Loading\n首页与内容|Home & Content\n配置导入导出|Import / Export Settings\n设置分类|Settings Categories\n设置项|Settings Options\n已启用|Enabled\n已停用|Disabled\n来自订阅|From Subscription\n手动添加|Added Manually\n全部启用|Enable All\n全部停用|Disable All\n批量测活|Test All\n取消测活|Cancel Tests\n全部恢复|Restore All\n恢复|Restore\n失败|Failed\n可用|Available\n不可用|Unavailable\n添加 API|Add API\n添加直播源|Add Live TV Source\n添加第一个点播源|Add Your First Movie Source\n添加第一个直播源|Add Your First Live Source\n没有符合条件的源|No Matching Sources\n没有找到匹配的结果|No Matching Results\n还没有添加任何点播源|No Movie Sources Added\n还没有添加任何直播源|No Live TV Sources Added\n尚未勾选点播源|No Movie Sources Enabled\n先添加一个点播源|Add a Movie Source to Begin\n请尝试其他关键词或更换点播源|Try another search or change sources\n请先在设置中添加并勾选点播源|Add and enable a movie source in Settings first\n暂无介绍|No description available\n选择来源|Choose Source\n选择播放源|Choose Playback Source\n当前|Current\n播放中|Now Playing\n速度|Speed\n集数|Episodes\n当前正在播放|Currently Playing\n切换到此源|Switch to This Source\n重新测速|Retest\n测速中...|Testing Speed...\n正在搜索各资源...|Searching Sources...\n正在测试各资源速率...|Testing Source Speed...\n无资源|No Stream\n源站未提供画质|Quality unavailable\n探测中|Checking\n未知视频|Unknown Video\n未知频道|Unknown Channel\n等待访问验证...|Checking access...\n点播源不存在|Movie Source Not Found\n返回首页|Return Home\n下载本集|Download Episode\n切换资源|Change Source\n上一集|Previous Episode\n下一集|Next Episode\n上一台|Previous Channel\n下一台|Next Channel\n自动连播|Autoplay Next Episode\n剧集列表|Episode List\n暂无剧集信息|No Episode Information\n获取剧集失败|Failed to Load Episodes\n获取详情失败|Failed to Load Details\n正在获取剧集信息...|Loading Episodes...\n未找到播放资源|No Playable Source Found\n复制链接|Copy Link\n复制播放地址|Copy Stream URL\n已复制|Copied\n类型|Genre\n年份|Year\n地区|Region\n导演|Director\n主演|Cast\n备注|Notes\n节目单|TV Guide\n频道列表|Channel List\n频道|Channels\n正在播出|On Now\n接下来|Up Next\n节目单加载失败|TV Guide Failed to Load\n当前时段暂无节目数据|No programming information for this time\n测试可用性|Test Availability\n测活|Check Availability\n广告切片过滤|Filter Ad Segments\n自动跳过片段|Auto-Skip Segments\n片段本地缓存|Cache Video Segments\n清除全部|Clear All\n清理缓存|Clear Cache\n加载方式|Loading Method\n直连优先|Direct First\n内置代理|Built-in Proxy\n自定义|Custom\n成人内容过滤|Adult Content Filter\n首页推荐|Home Recommendations\n推荐数据源|Recommendation Provider\n电影周榜|Weekly Movies\n国产剧周榜|Weekly Chinese TV\n海外剧周榜|Weekly International TV\n国内综艺|Chinese Variety\n海外综艺|International Variety\n百度热播剧|Trending TV\n导出数据源|Export Sources\n发布为链接|Publish Shareable Link\n直接订阅|Subscribe\n订阅|Subscribe\n重新同步|Sync Again\n删除订阅|Delete Subscription\n导出配置|Export Settings\n导入配置|Import Settings\n导入并覆盖|Import and Replace\nAPI 地址|API URL\n部署者预置|Configured by Administrator\n排队中|Queued\n下载中|Downloading\n已暂停|Paused\n已完成|Completed\n暂停|Pause\n继续|Resume\n跳过标记|Skip Markers\n跳过片段标记|Skip Segment Markers\n记为片头结束|Mark Opening End\n记为片尾开始|Mark Ending Start\n标记中段起点|Mark Middle Start\n标记中段终点|Mark Middle End\n本剧跳过|Skip for This Series\n起点|Start\n终点|End\n跳过片头|Skip Opening\n跳过片尾|Skip Ending\n跳过中段|Skip Segment\n重新加载|Reload\n播放/暂停|Play / Pause\n关于 LibreTV|About LibreTV\n快捷键|Keyboard Shortcuts\n隐私与数据|Privacy & Data\n免责声明|Disclaimer\n已是最新版本|You are up to date\n正在检测更新…|Checking for updates…\n周一|Monday\n周二|Tuesday\n周三|Wednesday\n周四|Thursday\n周五|Friday\n周六|Saturday\n周日|Sunday";
const labels = new Map<string, string>(pairs.split('\n').map((line) => {
  const cut = line.indexOf('|');
  return [line.slice(0, cut), line.slice(cut + 1)] as const;
}));

const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d+)\s*个来源$/, (n) => n + ' sources'],
  [/^(\d+)\s*源$/, (n) => n + ' sources'],
  [/^共\s*(\d+)\s*集$/, (n) => n + ' episodes'],
  [/^(\d+)\s*集$/, (n) => n + ' episodes'],
  [/^第\s*(\d+)\/(\d+)\s*集$/, (n, total) => 'Episode ' + n + '/' + total],
  [/^显示\s*(\d+)\s*个$/, (n) => 'Showing ' + n],
  [/^探测中\s*(\d+)\/(\d+)$/, (n, total) => 'Checking ' + n + '/' + total],
  [/^加载更多（还有\s*(\d+)\s*部）$/, (n) => 'Load More (' + n + ' remaining)'],
  [/^共\s*(\d+)\s*个\s*·\s*已启用\s*(\d+)$/, (total, enabled) => total + ' total · ' + enabled + ' enabled'],
];

const attributes = ['placeholder', 'aria-label', 'title', 'alt'];
const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'OPTION']);

function english(text: string): string {
  const trimmed = text.trim();
  if (!/[\u3400-\u9fff]/u.test(trimmed)) return text;
  let translation = labels.get(trimmed);
  if (!translation) for (const [pattern, format] of patterns) {
    const match = pattern.exec(trimmed);
    if (match) { translation = format(...match.slice(1)); break; }
  }
  if (!translation) return text;
  const left = text.slice(0, text.length - text.trimStart().length);
  const right = text.slice(text.trimEnd().length);
  return left + translation + right;
}

function translateText(node: Node) {
  if (node.nodeType !== Node.TEXT_NODE) return;
  const parent = node.parentElement;
  if (!parent || ignored.has(parent.tagName) || parent.closest('[contenteditable="true"], [data-no-english]')) return;
  const before = node.textContent || '';
  const after = english(before);
  if (before !== after) node.textContent = after;
}

function translateElement(element: Element) {
  if (!(element instanceof HTMLElement) || element.closest('[data-no-english]')) return;
  for (const attribute of attributes) {
    const before = element.getAttribute(attribute);
    if (before === null) continue;
    const after = english(before);
    if (before !== after) element.setAttribute(attribute, after);
  }
}

function translateBranch(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (ignored.has((root as Element).tagName)) return;
  translateElement(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let next: Node | null;
  while ((next = walker.nextNode())) {
    if (next.nodeType === Node.TEXT_NODE) translateText(next);
    else translateElement(next as Element);
  }
}

export default function EnglishInterface() {
  useEffect(() => {
    document.documentElement.lang = 'en';
    translateBranch(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        else if (record.type === 'attributes') translateElement(record.target as Element);
        else for (const node of Array.from(record.addedNodes)) translateBranch(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    return () => observer.disconnect();
  }, []);
  return null;
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client-api';
import type { SearchResultItem, VideoDetail } from '@/lib/types';
import { buildWatchUrl } from '@/lib/utils';
import { SmartImage } from './smart-image';
import { useAppStore, resolveSource } from '@/lib/store';
import { useToast } from './toast';
import { cn } from '@/lib/utils';
import { addSearchHistory } from '@/lib/db';
import { copyToClipboard } from '@/lib/clipboard';
import { EmptyState, ErrorState, LoadingState } from './states';
import { useFocusTrap } from './use-focus-trap';
import { Icon } from './icon';
import { useEnglishMetadata } from './use-english-metadata';
import { englishRegionFromChinese } from '@/lib/english-display';
import { categoriesFromCms } from '@/lib/browse-categories';

/**
 *  Details弹窗：剧集列表 + 排序 + Copy Link。
 * 剧集点击 → /watch 路由（URL 携带定位参数，可分享、可后退）。
 */

export function DetailModal({ item, onClose }: { item: SearchResultItem | null; onClose: () => void }) {
  const metadataInputs=useMemo(()=>item?[item]:[],[item]);
  const english=useEnglishMetadata(metadataInputs);
  const enriched=english.items[0];
  const displayTitle=enriched?.englishTitle || 'English title unavailable';
  const trailerUrl=enriched?.trailerUrl || (enriched?.englishTitle
    ? 'https://www.youtube.com/results?search_query='+encodeURIComponent(enriched.englishTitle+' '+(enriched.year||'')+' official trailer')
    : undefined);
  const store = useAppStore();
  const router = useRouter();
  const { toast } = useToast();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reversed, setReversed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 打开时把焦点移入弹窗、Tab 圈闭在弹窗内、Close后归还焦点
  useFocusTrap(Boolean(item), panelRef);

  useEffect(() => setPosterFailed(false), [item?.pic, store.imageProxyMode, store.customImageProxy]);

  // 弹窗打开期间锁定背景滚动
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [item]);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      setError('');
      setLoading(false);
      return;
    }
    const source = resolveSource(store, item.sourceKey, {
      url: item.sourceUrl,
      name: item.sourceName,
    });
    if (!source) {
      setDetail(null);
      setLoading(false);
      setError('This movie source is no longer configured. Re-add it in Settings.');
      return;
    }
    setLoading(true);
    setDetail(null);
    setError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Bound the waiting state independently of upstream and gateway timeouts.
    const deadline = setTimeout(() => {
      controller.abort(new DOMException('Episode details timed out', 'TimeoutError'));
    }, 12_000);
    api
      .detail(item.vodId, source, controller.signal)
      .then((d) => {
        if (abortRef.current === controller && !controller.signal.aborted) setDetail(d);
      })
      .catch((err) => {
        if (abortRef.current !== controller) return;
        if (controller.signal.reason instanceof DOMException && controller.signal.reason.name === 'TimeoutError') {
          setError('This movie source did not respond in time. Retry or choose another source.');
          return;
        }
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load details');
      })
      .finally(() => {
        clearTimeout(deadline);
        if (abortRef.current === controller) setLoading(false);
      });
    return () => {
      clearTimeout(deadline);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, retryCount]);

  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item, onClose]);

  if (!item) return null;

  const episodes = detail ? (reversed ? [...detail.episodes].reverse() : detail.episodes) : [];
  const info = detail?.videoInfo;

  const play = (index: number) => {
    if (!detail || !detail.episodes[index]) return;
    addSearchHistory(enriched?.englishTitle || item.name).catch(() => {});
    router.push(
      buildWatchUrl({
        sourceKey: item.sourceKey,
        vodId: item.vodId,
        index,
        title: enriched?.englishTitle || 'Movie',
        sourceUrl: item.sourceUrl,
      })
    );
  };

  const copyLinks = async () => {
    if (!detail?.episodes.length) return;
    // A browser address bar joins multiple pasted lines into one invalid URL.
    // Share the LibreTV watch page instead of raw HLS playlists, which may
    // require the app's player, headers, or server proxy to play correctly.
    const watchPath = buildWatchUrl({
      sourceKey: item.sourceKey,
      vodId: item.vodId,
      index: 0,
      title: enriched?.englishTitle || 'Movie',
      sourceUrl: item.sourceUrl,
    });
    const ok = await copyToClipboard(new URL(watchPath, window.location.origin).href);
    if (ok) toast('Watch link copied', 'success');
    else toast('Copy failed. Check your browser permissions.', 'error');
  };

  // Notes与卡片同源，同样归一化，避免同一部剧在两处显示不同文案
  const englishGenre=enriched?.englishGenre || (info?.typeName
    ? categoriesFromCms({class:[{type_id:1,type_name:info.typeName}]})[0]?.label : undefined);
  const englishRegion=enriched?.englishRegion || englishRegionFromChinese(info?.area);
  const metaRows = [
    englishGenre && ['Genre', englishGenre],
    (info?.year || enriched?.year) && ['Year', info?.year || enriched?.year || ''],
    englishRegion && ['Region', englishRegion],
    enriched?.englishDirector && ['Director', enriched.englishDirector],
    enriched?.englishCast && ['Cast', enriched.englishCast],
    enriched?.runtime && ['Runtime', enriched.runtime],
    info?.remarks && /HD|高清/i.test(info.remarks) && ['Availability','HD available'],
  ].filter(Boolean) as [string, string][];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 py-10 px-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-surface-raised rounded-xl w-full max-w-3xl shadow-2xl animate-slide-up outline-none"
        role="dialog"
        aria-modal="true"
        aria-label={`${displayTitle} Details`}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-content break-words">{displayTitle}</h2>
            <span data-no-english className="text-sm text-faint">{item.sourceName}</span>
          </div>
          <button
            className="p-1.5 rounded-md text-muted hover:text-content hover:bg-hover shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 pt-4">
          {loading && <LoadingState label="Loading episodes..." />}

          {!loading && error && <ErrorState message={error || 'Loading failed'} onRetry={() => setRetryCount((n) => n + 1)} />}

          {!loading && !error && detail && (
            <>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                {item?.pic && !posterFailed && (
                  <SmartImage
                    url={item.pic}
                    mode={store.imageProxyMode}
                    customProxy={store.customImageProxy}
                    alt={displayTitle}
                    className="w-24 sm:w-32 aspect-[2/3] object-cover rounded-lg bg-chip shrink-0 self-center sm:self-start"
                    loading="eager"
                    onExhausted={() => setPosterFailed(true)}
                  />
                )}
                <div className="min-w-0 space-y-3">
                  {metaRows.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      {metaRows.map(([k, v]) => (
                        <div key={k} className="truncate" title={`${k}: ${v}`}>
                          <span className="text-faint">{k}:</span>{' '}
                          <span className="text-content">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {enriched?.imdbRating!==undefined && (
                      <a href={enriched.imdbId ? 'https://www.imdb.com/title/'+enriched.imdbId+'/' : '#'} target="_blank" rel="noopener noreferrer"
                        className="tag bg-amber-500/15 text-amber-300">IMDb {enriched.imdbRating.toFixed(1)} / 10</a>
                    )}
                    {enriched?.imdbId && !enriched.imdbRating && (
                      <a className="text-accent underline" target="_blank" rel="noopener noreferrer"
                        href={'https://www.imdb.com/title/'+enriched.imdbId+'/'}>IMDb page · Not rated</a>
                    )}
                    {trailerUrl && <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost btn-sm">{enriched?.trailerUrl ? 'Watch trailer on YouTube' : 'Find trailer on YouTube'}</a>}
                  </div>
                  {english.loading ? (
                    <p className="text-sm text-muted">Loading English movie details…</p>
                  ) : (
                    <p className="text-sm text-muted leading-relaxed">{enriched?.englishDescription || 'English synopsis not available for this title.'}</p>
                  )}
                </div>
              </div>

              {episodes.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setReversed((v) => !v)}
                        aria-label={reversed ? 'Sort ascending' : 'Sort descending'}
                        title="Change episode sort order"
                      >
                        <Icon
                          name="arrowDown"
                          className={cn('w-3.5 h-3.5 transition-transform', reversed && 'rotate-180')}
                        />
                        {reversed ? 'Ascending' : 'Descending'}
                      </button>
                      <span className="text-sm text-faint">Total {episodes.length} episodes</span>
                    </div>
                    <button className="btn-primary btn-sm" onClick={copyLinks}>
                      Copy Link
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 max-h-[40vh] overflow-y-auto scrollbar-thin pr-1">
                    {episodes.map((_, i) => {
                      const realIndex = reversed ? detail.episodes.length - 1 - i : i;
                      return (
                        <button
                          key={realIndex}
                          className="btn-ghost btn-sm !px-1 text-center"
                          onClick={() => play(realIndex)}
                        >
                          {realIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="alert"
                  title="No playable source found"
                  description="This video may not be available. Try another title."
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

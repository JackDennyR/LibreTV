'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from './toast';
import { api } from '@/lib/client-api';
import { formatRelativeTime, hostnameOf, validateSourceUrl, cn } from '@/lib/utils';
import { SearchInput, SectionTitle, TestBadge, useSourceTests } from './settings-shared';
import { EmptyState } from './states';
import { Icon } from './icon';

/**
 * Live TV Source管理（嵌入设置抽屉）：M3U Subscription的Add / 探活 / 移除 / 导出，
 * 以及Preconfigured源展示。工具条、徽章、空态与Undo语义与点播源面板保持一致。
 */

type LiveFilter = 'all' | 'enabled' | 'disabled' | 'sub' | 'manual';

// 与点播源面板保持同一组筛选项与顺序：先状态（已Enable / Disabled），后来源（From Subscription / Added Manually）
const LIVE_FILTERS: { id: LiveFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'sub', label: 'From Subscription' },
  { id: 'manual', label: 'Added Manually' },
];

interface LiveRow {
  url: string;
  label: string;
  epgUrl?: string;
  preset: boolean;
  lastSync?: number;
  fromSubscriptions: string[];
}

export function LiveSourceManager() {
  const store = useAppStore();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  /** 正在Edit的手动源 URL（与「Add」共用同一表单） */
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LiveFilter>('all');
  const { tests, runTest } = useSourceTests();

  const rows = useMemo<LiveRow[]>(() => {
    const preset: LiveRow[] = store.liveEnvSources.map((s) => ({
      url: s.url,
      label: s.name || hostnameOf(s.url),
      epgUrl: s.epg,
      preset: true,
      fromSubscriptions: [],
    }));
    const subs: LiveRow[] = store.liveSubscriptions.map((s) => ({
      url: s.url,
      label: s.name || hostnameOf(s.url),
      epgUrl: s.epg,
      preset: false,
      lastSync: s.lastSync,
      fromSubscriptions: s.fromSubscriptions,
    }));
    const all = [...preset, ...subs];
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (filter === 'enabled' && !store.liveSelectedUrls.includes(r.url)) return false;
      if (filter === 'disabled' && store.liveSelectedUrls.includes(r.url)) return false;
      if (filter === 'sub' && r.fromSubscriptions.length === 0) return false;
      if (filter === 'manual' && !(r.fromSubscriptions.length === 0 && !r.preset)) return false;
      if (!q) return true;
      return r.label.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
    });
  }, [store.liveEnvSources, store.liveSubscriptions, store.liveSelectedUrls, query, filter]);

  // Edit中的手动源（与「Add」共用同一表单）
  const editingSource = editing ? store.liveSubscriptions.find((s) => s.url === editing) : undefined;

  const exportM3u = (url: string) => {
    window.open(api.liveExportUrl(url), '_blank', 'noopener');
  };

  const allEnabled = rows.length > 0 && rows.every((r) => store.liveSelectedUrls.includes(r.url));
  const toggleAll = () => {
    // 只翻转状态与目标不一致的源，一次批量 set 完成（逐条 toggle 会触发 O(n) 次持久化）
    const targets = rows
      .filter((r) => store.liveSelectedUrls.includes(r.url) === allEnabled)
      .map((r) => r.url);
    if (targets.length > 0) useAppStore.getState().toggleLiveSelectedMany(targets);
  };

  const removeWithUndo = (row: LiveRow) => {
    const snapshot = useAppStore.getState().removeLiveSubscription(row.url);
    if (!snapshot) return;
    // 正在Edit的条目被移除时收起表单，避免表单悬空
    if (editing === row.url) setEditing(null);
    toast(`Removed 「${row.label}」`, 'info', {
      action: {
        label: 'Undo',
        onClick: () => {
          useAppStore.getState().restoreLiveSubscription(snapshot);
          toast('Restored', 'success');
        },
      },
    });
  };

  const empty = store.liveEnvSources.length === 0 && store.liveSubscriptions.length === 0;

  return (
    <section>
      <SectionTitle
        title="Live TV Source"
        hint={empty ? 'M3U playlist · Watch on /live' : `Total ${store.liveEnvSources.length + store.liveSubscriptions.length} · Enabled ${store.liveSelectedUrls.length}`}
        extra={
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" className="w-3.5 h-3.5" />
            AddLive TV Source
          </button>
        }
      />

      {/* 与点播源一致：由「+ Add / Edit」按钮展开同一表单，而非常驻占位 */}
      <LiveSourceForm
        visible={adding || editingSource !== undefined}
        initial={editingSource}
        onCancel={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSubmit={(data) => {
          if (editing) {
            // Edit模式：只Update名称与 EPG（地址不可改）
            store.updateLiveSubscription(editing, { name: data.name, epg: data.epg });
          } else {
            store.addLiveSubscription(data.url, data.name, data.epg);
            void runTest(data.url, () => api.liveTest(data.url));
          }
          setAdding(false);
          setEditing(null);
        }}
      />

      {empty && !adding && editingSource === undefined ? (
        <EmptyState
          icon="link"
          title="No Live TV Source"
          description="Add an M3U URL to browse and play channels on the Live TV page. You can also import playlists using Source Subscriptions or configure DEFAULT_LIVE_SOURCES."
          action={
            <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
              Add Your First Live TV Source
            </button>
          }
        />
      ) : (
        <>
          <div className="space-y-2 mb-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by name or URL" />
            <div className="flex flex-wrap items-center gap-1">
              {LIVE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={cn(
                    'chip',
                    filter === f.id ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-content hover:bg-hover'
                  )}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-faint">Showing {rows.length} items</span>
            </div>
            <button className="btn-ghost btn-sm" onClick={toggleAll} disabled={rows.length === 0}>
              {allEnabled ? 'Disable All' : 'Enable All'}
            </button>
          </div>

          {rows.length === 0 ? (
            <EmptyState variant="plain" title="No matching sources" />
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const enabled = store.liveSelectedUrls.includes(row.url);
                const fromSubscription = row.fromSubscriptions.length > 0;
                return (
                  <li
                    key={row.url}
                    className={cn(
                      'bg-card rounded-lg p-3 transition-colors hover:bg-hover/50',
                      // 未勾选 = 不参与直播列表：淡显，与点播源面板保持同一套停用观感
                      !enabled && 'opacity-70'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent shrink-0"
                        checked={enabled}
                        onChange={() => useAppStore.getState().toggleLiveSelected(row.url)}
                        aria-label={enabled ? `Disable ${row.label}` : `Enable ${row.label}`}
                        title={enabled ? 'Enabled. Uncheck to disable.' : 'Disabled. Check to enable.'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-content truncate">
                          {row.label}
                          {row.preset && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-chip text-faint align-middle">
                              Preconfigured
                            </span>
                          )}
                          {fromSubscription && (
                            <span
                              className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent align-middle"
                              title={`From ${row.fromSubscriptions.length} source subscriptions. This source is removed only when no subscriptions reference it.`}
                            >
                              Subscription
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-faint truncate">
                          {row.url}
                          {row.epgUrl && ' · TV guide configured'}
                          {row.lastSync && ` · Synced ${formatRelativeTime(row.lastSync)}`}
                        </div>
                      </div>
                      <TestBadge
                        state={tests[row.url]}
                        onTest={() => runTest(row.url, () => api.liveTest(row.url))}
                        title="Load playlist and test channel availability"
                        badgeWhenOk={({ count }) => `✓ ${count ?? 0} channels`}
                      />
                      <button
                        className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-accent shrink-0"
                        onClick={() => exportM3u(row.url)}
                        aria-label="Export M3U"
                        title="Export as a standard M3U file"
                      >
                        <Icon name="download" className="w-4 h-4" />
                      </button>
                      {row.preset ? null : fromSubscription ? (
                        <>
                          {/* Subscription源由远端列表管理：Edit会被下次同步覆盖、Delete会复活，故置为禁用态并指路 */}
                          <button
                            className="rounded-md p-2 text-muted/30 cursor-not-allowed shrink-0"
                            disabled
                            aria-label="Subscription source cannot be edited separately"
                            title="This source belongs to a subscription. Changes will be overwritten when it syncs again. Edit the remote subscription."
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button
                            className="rounded-md p-2 text-muted/30 cursor-not-allowed shrink-0"
                            disabled
                            aria-label="Subscription source cannot be removed separately"
                            title="Remove the subscription from Source Subscriptions instead."
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-accent shrink-0"
                            onClick={() => setEditing(row.url)}
                            aria-label="Edit"
                            title="Edit name and TV guide URL"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button
                            className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                            onClick={() => removeWithUndo(row)}
                            aria-label="Remove live TV source"
                            title="Remove (undo is available)"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** Live TV Source表单：与点播源一致，由「+ Add / Edit」按钮展开；Edit时地址只读、提交后自动探活（仅新增） */
function LiveSourceForm({
  visible,
  initial,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  /** Edit模式：仅允许改名称与 EPG，地址只读 */
  initial?: { url: string; name?: string; epg?: string };
  onCancel: () => void;
  onSubmit: (data: { url: string; name?: string; epg?: string }) => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [epg, setEpg] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (visible) {
      setUrl(initial?.url ?? '');
      setName(initial?.name ?? '');
      setEpg(initial?.epg ?? '');
    }
  }, [visible, initial]);

  if (!visible) return null;

  const submit = () => {
    if (initial) {
      onSubmit({ url: initial.url, name: name.trim() || undefined, epg: epg.trim() || undefined });
      return;
    }
    const u = url.trim();
    if (!validateSourceUrl(u)) {
      toast('Subscription URL must start with http:// or https://', 'warning');
      return;
    }
    onSubmit({ url: u, name: name.trim() || undefined, epg: epg.trim() || undefined });
  };

  return (
    <div className="space-y-2 border border-line rounded-lg p-3 bg-chip mb-2">
      <input
        className="input w-full disabled:opacity-60"
        aria-label="M3U playlist URL"
        placeholder="M3U playlist URL, e.g. https://example.com/list.m3u"
        value={url}
        maxLength={500}
        disabled={!!initial}
        title={initial ? 'The URL cannot be edited. Remove and re-add this source to change it.' : undefined}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        className="input w-full"
        aria-label="Live TV source name (optional)"
        placeholder="Optional name, e.g. My Channels"
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="input w-full"
        aria-label="EPG URL (optional)"
        placeholder="EPG TV guide URL (optional, XMLTV xml/xml.gz)"
        value={epg}
        maxLength={500}
        onChange={(e) => setEpg(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary btn-sm" onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}

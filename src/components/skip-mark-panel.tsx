'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  SEGMENT_COLORS,
  SEGMENT_LABELS,
  validateSegment,
  type SkipSegment,
  type SkipSegmentType,
} from '@/lib/skip-marks';
import { cn, formatTime } from '@/lib/utils';
import { useToast } from './toast';
import { Drawer } from './drawer';

/**
 * 播放页的「跳过标记」抽屉。
 *
 * 采集站不提供片头片尾元数据，边界只能由用户在看的时候标记一次，
 * 之后同剧各集与同名资源自动套用。 segment按位置归类：opening（片头 )、
 * middle（中段 )、ending（片尾 )。抽屉负责「记录/试跳/微调/删除」，
 * 真正的跳过判定在 player-shell.tsx，存储与校验在 lib/skip-marks.ts。
 *
 * 交互约定：
 * - 抽屉是非模态的：不遮光、不锁滚动、不挡点击。标记的前提是"看着画面记边界"，
 *   模态遮罩会把正在播的视频压暗并吃掉点击，反而没法边看边标；
 * - 手机上（<lg )退化成底部半屏抽屉，并把记录按钮放在 footer 常驻，避免盖住画面、
 *   也避免列表变长后要滚到底才能记一笔；
 * - 记录/试跳前先暂停：点击到读取之间视频还在走，容易偏 1–2 秒；
 * - 顶部常驻「Current 12:34 / 45:00」，试跳与微调都有参照；
 * - 中段两步态的起点由播放页持有（pendingStart )，与 Shift+S/E 共用同一份状态；
 * - 全局「自动跳过 segment」在这里只读展示（层级不同，避免和「Skip for This Series」并排成两个 checkbox )。
 */

interface PlayerClock {
  currentTime: number;
  duration: number;
  seek(seconds: number): void;
  pause(): void;
  isPaused(): boolean;
}

const SEGMENT_TYPES: SkipSegmentType[] = ['opening', 'middle', 'ending'];

const round1 = (v: number) => Math.round(v * 10) / 10;

export function SkipMarkPanel({
  open,
  onClose,
  markKey,
  pendingStart,
  onPendingStart,
  getPlayerClock,
  mobileMaxHeight,
}: {
  open: boolean;
  onClose: () => void;
  /** 已归一化的标记键（watch 页按剧名计算 ) */
  markKey: string;
  /** 中段两步态起点（页面层持有 ) */
  pendingStart: number | null;
  onPendingStart: (start: number | null) => void;
  /** 读取播放器Current时间/时长/跳转；播放器未就绪时返回 null */
  getPlayerClock: () => PlayerClock | null;
  /**
   * 小屏抽屉的最大高度（px，由播放页按播放器底边算出 )：
   * 视口矮、播放器占比大时靠它保证抽屉不压住画面；未传则用默认 60vh。
   */
  mobileMaxHeight?: number;
}) {
  const mark = useAppStore((s) => s.skipMarks[markKey]);
  const setSkipMark = useAppStore((s) => s.setSkipMark);
  const setSkipMarkEnabled = useAppStore((s) => s.setSkipMarkEnabled);
  const autoSkipSegments = useAppStore((s) => s.autoSkipSegments);
  const { toast } = useToast();

  const segments = (mark?.segments ?? []).slice().sort((a, b) => a.start - b.start);
  const enabled = mark ? mark.enabled !== false : false;

  // Current进度：抽屉打开时每秒刷新一次；用 ref 拿最新的取数函数，避免每秒重置定时器
  const clockFnRef = useRef(getPlayerClock);
  clockFnRef.current = getPlayerClock;
  const [clock, setClock] = useState({ current: 0, duration: 0, paused: true });
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const c = clockFnRef.current();
      setClock({
        current: c?.currentTime ?? 0,
        duration: c?.duration ?? 0,
        paused: c ? c.isPaused() : true,
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open]);

  const write = (next: SkipSegment[]) => setSkipMark(markKey, next);

  // 记录/试跳前统一「先暂停再取时间」：暂停后 currentTime 才是用户看到的画面位置
  const pauseAndSnap = (): { t: number; duration: number } | null => {
    const c = getPlayerClock();
    if (!c) {
      toast('The player is not ready yet. Please try again.', 'warning');
      return null;
    }
    if (!c.isPaused()) c.pause();
    setClock({ current: c.currentTime, duration: c.duration, paused: true });
    return { t: round1(c.currentTime), duration: c.duration };
  };

  /** 记录一条 segment；成功返回 true（失败时保留两步态，用户可以改位置重试 ) */
  const tryRecord = (segment: SkipSegment, label: string, duration: number): boolean => {
    const error = validateSegment(segment, duration, segments);
    if (error) {
      toast(error, 'error');
      return false;
    }
    write([...segments, segment]);
    const effect = autoSkipSegments
      ? segment.type === 'ending'
        ? '; playback will end automatically after the marker'
        : '; this segment will be skipped automatically'
      : segment.type === 'ending'
        ? '; a Skip Ending button will appear'
        : '; a Skip button will appear';
    const at =
      segment.type === 'ending'
        ? formatTime(segment.start)
        : segment.type === 'middle'
          ? `${formatTime(segment.start)} → ${formatTime(segment.end)}`
          : formatTime(segment.end);
    toast(`Recorded ${label} ${at}${effect}`, 'success');
    return true;
  };

  const recordAt = (type: 'opening' | 'ending') => {
    const snap = pauseAndSnap();
    if (!snap) return;
    if (snap.t <= 0) {
      toast(type === 'opening' ? 'Play to the end of the opening first' : 'Play to the start of the ending first', 'warning');
      return;
    }
    if (type === 'opening') tryRecord({ type, start: 0, end: snap.t }, 'Opening End', snap.duration);
    else tryRecord({ type, start: snap.t, end: -1 }, 'Ending Start', snap.duration);
  };

  const markMiddleStart = () => {
    const snap = pauseAndSnap();
    if (!snap) return;
    if (snap.t <= 0) {
      toast('Play to the segment start first', 'warning');
      return;
    }
    onPendingStart(snap.t);
    toast(`Paused and recorded start at ${formatTime(snap.t)}; play to the end and choose Mark Middle End`, 'info');
  };

  const markMiddleEnd = () => {
    if (pendingStart === null) return;
    const snap = pauseAndSnap();
    if (!snap) return;
    if (snap.t <= pendingStart) {
      toast('The end must be after the start', 'warning');
      return;
    }
    if (tryRecord({ type: 'middle', start: pendingStart, end: snap.t }, 'Middle Segment', snap.duration)) {
      onPendingStart(null);
    }
  };

  const remove = (index: number) => {
    const seg = segments[index];
    if (!seg) return;
    const wasDisabled = mark?.enabled === false;
    write(segments.filter((_, i) => i !== index));
    // 删除可Undo：误删后不必再拖回原位置重标
    toast(`Deleted ${SEGMENT_LABELS[seg.type]} segment`, 'info', {
      action: {
        label: 'Undo',
        onClick: () => {
          setSkipMark(markKey, segments);
          if (wasDisabled) setSkipMarkEnabled(markKey, false);
        },
      },
    });
  };

  const nudge = (index: number, delta: number) => {
    const seg = segments[index];
    if (!seg) return;
    const changed: SkipSegment =
      seg.type === 'ending'
        ? { ...seg, start: round1(seg.start + delta) }
        : seg.type === 'opening'
          ? { ...seg, end: round1(seg.end + delta) }
          : { ...seg, start: round1(seg.start + delta), end: round1(seg.end + delta) };
    const clockNow = getPlayerClock();
    const others = segments.filter((_, i) => i !== index);
    const error = validateSegment(changed, clockNow?.duration ?? 0, others);
    if (error) {
      toast(error, 'error');
      return;
    }
    write(segments.map((s, i) => (i === index ? changed : s)));
  };

  /** 试跳：跳到后保持暂停，让用户先确认画面（终点落在 segment末尾前 1s ) */
  const jump = (seg: SkipSegment, to: 'start' | 'end') => {
    const c = getPlayerClock();
    if (!c) {
      toast('The player is not ready yet. Please try again.', 'warning');
      return;
    }
    c.pause();
    c.seek(to === 'start' ? seg.start : Math.max(0, seg.end - 1));
    setClock({ current: to === 'start' ? seg.start : Math.max(0, seg.end - 1), duration: c.duration, paused: true });
  };

  /** Current播放位置落在哪个 segment里：列表里高亮出来，方便核对边界 */
  const currentKey = segments.find((s) => {
    if (clock.current < s.start) return false;
    if (s.type === 'ending') return true;
    return clock.current < s.end;
  });

  return (
    // 桌面端宽度收窄到 320px：播放页右侧剧集栏是 300px，抽屉正好盖住它而不压到视频；
    // 记录区放进 footer 常驻底部：手机上侧栏只占下半屏，滚到列表末尾再点按钮太别扭
    <Drawer
      open={open}
      onClose={onClose}
      title="Skip Markers"
      width="max-w-sm lg:max-w-[20rem]"
      modal={false}
      mobileSheet
      panelStyle={mobileMaxHeight ? { maxHeight: mobileMaxHeight } : undefined}
      footer={
        <div>
          <p className="mb-1.5 text-[11px] text-faint">Mark a segment (pauses at the current frame)</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="btn-ghost btn-sm"
              title="Mark the current frame as the end of the opening"
              onClick={() => recordAt('opening')}
            >
              Mark Opening End
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              title="Mark the current frame as the start of the ending"
              onClick={() => recordAt('ending')}
            >
              Mark Ending Start
            </button>
            {pendingStart === null ? (
              <button type="button" className="btn-ghost btn-sm" onClick={markMiddleStart}>
                Mark Middle Start
              </button>
            ) : (
              <>
                <button type="button" className="btn-ghost btn-sm" onClick={markMiddleEnd}>
                  Mark Middle End (from {formatTime(pendingStart)} )
                </button>
                <button type="button" className="btn-ghost btn-sm" title="Discard this start marker" onClick={() => onPendingStart(null)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Current进度 + 本剧开关：本剧作用域放最上，全局开关在底部只读展示，避免两个层级并排 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">
            Current{' '}
            <span className="font-mono text-content">{formatTime(clock.current)}</span>
            <span className="text-faint"> / {formatTime(clock.duration)}</span>
            {clock.paused && <span className="ml-1 text-faint">· Paused</span>}
          </p>
          <p className="mt-1 text-[11px] text-faint">
            Marked {segments.length} segments · Applies to episodes and matching sources for this series
          </p>
        </div>
        <label
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-xs',
            mark ? 'cursor-pointer text-muted hover:text-content' : 'cursor-not-allowed text-faint/70'
          )}
          title={mark ? 'Disable skipping without removing markers' : 'No markers to enable or disable'}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-accent"
            checked={enabled}
            disabled={!mark}
            onChange={(e) => setSkipMarkEnabled(markKey, e.target.checked)}
          />
          Skip for This Series
        </label>
      </div>

      {segments.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 text-xs leading-relaxed text-faint">
          No skip markers yet.Play to the desired time and use the buttons or keyboard shortcuts:
          Shift+I Opening End / Shift+O Ending Start / Shift+S · Shift+E Middle Segment。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {segments.map((seg, i) => {
            const isCurrent = currentKey === seg;
            return (
              <li
                key={`${seg.type}:${seg.start}`}
                className={cn(
                  'rounded-lg border px-2.5 py-2 transition-colors',
                  isCurrent ? 'border-accent/60 bg-chip/60' : 'border-line/70'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: SEGMENT_COLORS[seg.type] }}
                    />
                    <span className="text-muted">[{SEGMENT_LABELS[seg.type]}]</span>
                    <span className="font-mono text-muted">
                      {formatTime(seg.start)} → {seg.type === 'ending' ? 'End' : formatTime(seg.end)}
                    </span>
                  </span>
                  {isCurrent && <span className="shrink-0 text-[10px] text-accent">Current</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    title="Jump to the start to check its position"
                    onClick={() => jump(seg, 'start')}
                  >
                    Start
                  </button>
                  {seg.type !== 'ending' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      title="Jump to one second before the end to verify the marker"
                      onClick={() => jump(seg, 'end')}
                    >
                      End
                    </button>
                  )}
                  <button type="button" className="btn-ghost btn-sm" title="Move the boundary back one second" onClick={() => nudge(i, -1)}>
                    -1s
                  </button>
                  <button type="button" className="btn-ghost btn-sm" title="Move the boundary forward one second" onClick={() => nudge(i, 1)}>
                    +1s
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    title="Delete (undo is available)"
                    onClick={() => remove(i)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 全局开关：只读展示（层级与本剧开关不同，改起来去设置里更不容易误解 ) */}
      <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Global · Auto-skip segments</span>
          <span className={cn('text-xs font-medium', autoSkipSegments ? 'text-accent' : 'text-faint')}>
            {autoSkipSegments ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          {autoSkipSegments
            ? 'Opening and middle segments are skipped automatically. Ending markers end the episode; autoplay controls the next episode.'
            : 'Show skip buttons without automatically skipping.'}
           Applies to all series. Change this under Settings / Preferences.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        <span>Timeline colors:</span>
        {SEGMENT_TYPES.map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: SEGMENT_COLORS[t] }}
            />
            {SEGMENT_LABELS[t]}
          </span>
        ))}
        <span className="w-full">An Undo button appears after a skip so you can return to the previous position.</span>
      </div>
    </Drawer>
  );
}

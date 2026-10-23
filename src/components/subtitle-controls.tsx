'use client';

import { useEffect, useRef, useState } from 'react';
import { languageName, toWebVtt, type SubtitleChoice, type SubtitleLanguage } from '@/lib/subtitles';

interface SubtitleControlsProps {
  title: string;
  episodeKey: string;
  onApply: (vtt: string, language: SubtitleLanguage) => Promise<void>;
  onDisable: () => void;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin' });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Subtitle service: HTTP ${response.status}`);
  return data;
}

export function SubtitleControls({ title, episodeKey, onApply, onDisable }: SubtitleControlsProps) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<SubtitleLanguage>('en');
  const [searchTitle, setSearchTitle] = useState(title);
  const [choices, setChoices] = useState<SubtitleChoice[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('Off');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  useEffect(() => setSearchTitle(title), [title]);

  useEffect(() => {
    // A sidecar subtitle belongs to a specific movie/episode, not the next episode.
    requestRef.current += 1;
    setSelected('Off');
    setChoices([]);
    setError('');
    setBusy(false);
    setSearchTitle(title);
    setOpen(false);
    onDisable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeKey]);

  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError('Choose a .srt or .vtt subtitle file.');
      return;
    }
    if (file.size > 1_000_000) {
      setError('Subtitle file must be smaller than 1 MB.');
      return;
    }
    const generation = ++requestRef.current;
    setBusy(true);
    try {
      const vtt = toWebVtt(await file.text());
      if (generation !== requestRef.current) return;
      await onApply(vtt, language);
      if (generation !== requestRef.current) return;
      setSelected(`${languageName(language)} · Uploaded`);
      setOpen(false);
    } catch (err) {
      if (generation === requestRef.current) setError(err instanceof Error ? err.message : 'Could not load subtitle file.');
    } finally {
      if (generation === requestRef.current) setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const search = async () => {
    const generation = ++requestRef.current;
    setBusy(true);
    setError('');
    setChoices([]);
    try {
      const params = new URLSearchParams({ title: searchTitle.trim(), language });
      const data = await apiJson<{ configured: boolean; items: SubtitleChoice[] }>(`/api/subtitles?${params}`);
      if (generation !== requestRef.current) return;
      setConfigured(data.configured);
      setChoices(data.items);
      if (data.configured && data.items.length === 0) setError('No matching subtitles found. Try the English movie title or upload a file.');
    } catch (err) {
      if (generation === requestRef.current) setError(err instanceof Error ? err.message : 'Subtitle search failed.');
    } finally {
      if (generation === requestRef.current) setBusy(false);
    }
  };

  const selectResult = async (choice: SubtitleChoice) => {
    const generation = ++requestRef.current;
    setBusy(true);
    setError('');
    try {
      const result = await apiJson<{ vtt: string }>('/api/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: choice.fileId }),
      });
      if (generation !== requestRef.current) return;
      await onApply(toWebVtt(result.vtt), choice.language);
      if (generation !== requestRef.current) return;
      setSelected(`${languageName(choice.language)} · Automatic`);
      setOpen(false);
    } catch (err) {
      if (generation === requestRef.current) setError(err instanceof Error ? err.message : 'Subtitle download failed.');
    } finally {
      if (generation === requestRef.current) setBusy(false);
    }
  };

  return (
    <div className="absolute top-3 right-3 z-30 text-left" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="rounded-md bg-black/80 border border-white/30 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-black focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Subtitles" aria-expanded={open} onClick={() => setOpen((v) => !v)} title={`Subtitles: ${selected}`}>
        CC · {selected}
      </button>
      {open && (
        <div role="dialog" aria-label="Subtitle settings" className="absolute right-0 top-10 w-[min(19rem,85vw)] max-h-[min(70vh,400px)] overflow-y-auto rounded-lg border border-white/20 bg-[#111827] p-3 text-white shadow-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Subtitles</strong>
            <button type="button" className="text-xs text-gray-300 hover:text-white" onClick={() => setOpen(false)} aria-label="Close subtitles">Close</button>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs" htmlFor="subtitle-lang">Language</label>
            <select id="subtitle-lang" className="grow min-w-0 rounded bg-gray-800 p-1.5 text-xs border border-gray-600" value={language}
              onChange={(e) => { setLanguage(e.target.value as SubtitleLanguage); setChoices([]); setError(''); }}>
              <option value="en">English</option><option value="ar">العربية (Arabic)</option>
            </select>
          </div>
          <button type="button" className="w-full text-left text-xs rounded border border-gray-600 px-2 py-2 hover:bg-gray-800"
            onClick={() => { ++requestRef.current; onDisable(); setSelected('Off'); setOpen(false); }}>
            Off — disable subtitles
          </button>
          <input ref={inputRef} type="file" accept=".srt,.vtt,text/vtt,text/plain" className="hidden" aria-label="Upload subtitle file"
            onChange={(e) => void upload(e.target.files?.[0])} />
          <button type="button" className="w-full text-left text-xs rounded border border-gray-600 px-2 py-2 hover:bg-gray-800" disabled={busy}
            onClick={() => inputRef.current?.click()}>
            Upload .srt / .vtt file
          </button>
          <div className="border-t border-gray-700 pt-2 space-y-2">
            <label htmlFor="subtitle-search-title" className="block text-xs text-gray-300">Automatic search · movie or series name</label>
            <input id="subtitle-search-title" type="text" value={searchTitle} maxLength={120}
              onChange={(e) => setSearchTitle(e.target.value)} placeholder="e.g. Jack Reacher"
              className="w-full rounded bg-gray-800 p-2 border border-gray-600 text-sm text-white" />
            <button type="button" className="rounded bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={busy || searchTitle.trim().length < 2} onClick={() => void search()}>
              {busy ? 'Loading…' : 'Find Subtitles'}
            </button>
            {configured === false && <p className="text-xs text-amber-300">Automatic search needs an OpenSubtitles API key configured in Railway (OPENSUBTITLES_API_KEY). File uploads work now.</p>}
            {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
            {choices.map((choice) => (
              <button type="button" key={choice.fileId} disabled={busy} onClick={() => void selectResult(choice)}
                className="block w-full truncate text-left text-xs rounded border border-gray-700 px-2 py-1.5 hover:bg-gray-800"
                title={choice.release}>
                {choice.release} · {choice.downloads} downloads
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

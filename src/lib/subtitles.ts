/** Only English and Arabic tracks are supported in this player. */
export type SubtitleLanguage = 'en' | 'ar';

export interface SubtitleChoice {
  fileId: number;
  language: SubtitleLanguage;
  release: string;
  fileName: string;
  downloads: number;
}

const CUE_TIMING = /^(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}/m;

/** Strictly validate and convert plain .srt/.vtt text to WebVTT for ArtPlayer. */
export function toWebVtt(input: string): string {
  if (input.length > 1_000_000) throw new Error('Subtitle file exceeds 1 MB');
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('Subtitle file is empty');
  if (/^WEBVTT(?:\s|$)/.test(text)) {
    if (!CUE_TIMING.test(text)) throw new Error('No valid subtitle timestamps found');
    return text + '\n';
  }
  if (!CUE_TIMING.test(text)) throw new Error('Invalid SRT subtitle file');
  return `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}(?::\d{2})?),(\d{3})/g, '$1.$2')}\n`;
}

export function languageName(lang: SubtitleLanguage): string {
  return lang === 'ar' ? 'العربية' : 'English';
}

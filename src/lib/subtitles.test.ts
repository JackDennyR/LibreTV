import { describe, expect, it } from 'vitest';
import { languageName, toWebVtt } from './subtitles';

describe('subtitle conversion', () => {
  it('converts SRT line endings and timestamps into WebVTT', () => {
    const result = toWebVtt('\uFEFF1\r\n00:00:01,000 --> 00:00:03,500\r\nمرحبا\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nHello');
    expect(result).toContain('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\nمرحبا');
    expect(result).toContain('00:00:04.000 --> 00:00:05.000');
  });
  it('preserves proper WebVTT', () => {
    expect(toWebVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello')).toContain('Hello');
  });
  it('rejects missing cues and oversized files', () => {
    expect(() => toWebVtt('hi there')).toThrow('Invalid SRT');
    expect(() => toWebVtt('a'.repeat(1_000_001))).toThrow('1 MB');
    expect(() => toWebVtt('WEBVTT\n\nnot a cue')).toThrow('timestamps');
  });
  it('uses English and Arabic labels', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('ar')).toBe('العربية');
  });
});

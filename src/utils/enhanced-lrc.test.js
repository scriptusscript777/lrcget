import { describe, expect, it } from 'vitest'
import { parseImportedLyrics } from './lyrics-import.js'
import { normalizeLrclibLyrics, serializeLyricsfile, parseLyricsfile } from './lyricsfile.js'
import { hasMeasuredWordTiming } from './word-timing-status.js'

describe('enhanced lyrics integration', () => {
  const content =
    '[00:01.000]<00:01.100>Hello <00:01.500><00:02.000>world<00:02.500>\n[00:02.500]\n[00:04.000]ordinary line'
  it('imports explicit word ends and gaps without treating tags as words', () => {
    const result = parseImportedLyrics(content, 'song.elrc')
    expect(result.kind).toBe('synced')
    expect(result.lines[0]).toEqual({
      text: 'Hello world',
      start_ms: 1000,
      end_ms: 2500,
      words: [
        { text: 'Hello ', start_ms: 1100, end_ms: 1500 },
        { text: 'world', start_ms: 2000, end_ms: 2500 },
      ],
    })
    expect(result.lines[1].text).toBe('')
    expect(result.lines[2].words).toEqual([])
  })
  it('recognizes inline word tags inside .lrc files and retains untimed text in ELRC', () => {
    const result = parseImportedLyrics('Untimed text\n' + content, 'song.lrc')
    expect(result.lines[0]).toEqual({ text: 'Untimed text', words: [] })
    expect(hasMeasuredWordTiming(result.lines[1])).toBe(true)
  })
  it('retains imported words through internal save and reopening', () => {
    const imported = parseImportedLyrics(content, 'song.elrc')
    const saved = serializeLyricsfile({
      track: { title: 'Song', duration: 10 },
      plainLyrics: imported.plain,
      syncedLines: imported.lines,
    })
    const restored = parseLyricsfile(saved)
    expect(restored.syncedLines[0].words).toEqual(imported.lines[0].words)
    expect(restored.syncedLines[0].end_ms).toBe(2500)
    expect(normalizeLrclibLyrics({ lyricsfile: saved, hasWordSync: false }).hasWordSync).toBe(true)
  })
  it('uses ordinary LRC/plain fallback without trusting a word-sync flag', () => {
    expect(
      normalizeLrclibLyrics({ syncedLyrics: '[00:01.00]line', hasWordSync: true }).hasWordSync
    ).toBe(false)
    expect(normalizeLrclibLyrics({ plainLyrics: 'text' }).plainLyrics).toBe('text')
    expect(
      normalizeLrclibLyrics({ lyricsfile: 'broken: [', syncedLyrics: '[00:01.00]line' })
        .syncedLyrics
    ).toBe('[00:01.00]line')
  })
  it('displays the same structured lyrics that the backend applies rather than stale legacy text', () => {
    const lyricsfile = serializeLyricsfile({
      track: { title: 'Song', duration: 10 },
      plainLyrics: 'Hello world',
      syncedLines: parseImportedLyrics(content, 'song.elrc').lines,
    })
    const normalized = normalizeLrclibLyrics({
      lyricsfile,
      plainLyrics: 'stale',
      syncedLyrics: '[00:00.00]stale',
    })
    expect(normalized.plainLyrics).toBe('Hello world')
    expect(normalized.syncedLyrics).toContain('Hello world')
    expect(normalized.syncedLyrics).not.toContain('stale')
  })
  it('does not mark estimates or invalid word ranges as downloadable word timing', () => {
    expect(
      hasMeasuredWordTiming({
        text: 'word',
        start_ms: 1000,
        end_ms: null,
        words: [{ text: 'word', start_ms: 1000, end_ms: null }],
      })
    ).toBe(true)
    expect(
      hasMeasuredWordTiming({
        text: 'word',
        start_ms: 1000,
        end_ms: 1500.5,
        words: [{ text: 'word', start_ms: 1000 }],
      })
    ).toBe(false)
    expect(
      hasMeasuredWordTiming({ start_ms: 1000, words: [{ text: 'word', start_ms: 1000 }] })
    ).toBe(false)
    expect(hasMeasuredWordTiming({ start_ms: 1000, words: [{ text: '', start_ms: 1000 }] })).toBe(
      false
    )
    expect(hasMeasuredWordTiming({ text: 'word', words: [{ text: 'word' }] })).toBe(false)
    expect(
      hasMeasuredWordTiming({
        text: 'word',
        start_ms: 1000,
        words: [{ text: 'word', start_ms: 1000, end_ms: 900 }],
      })
    ).toBe(false)
  })
  it('does not resurrect stale line timing or instrumental flags when structured lyrics are plain', () => {
    const result = normalizeLrclibLyrics({
      lyricsfile: 'version: "1.0"\nmetadata: {}\nplain: Current plain text\nlines: []',
      syncedLyrics: '[00:01.00]stale line',
      instrumental: true,
    })
    expect(result.plainLyrics).toBe('Current plain text')
    expect(result.syncedLyrics).toBe('')
    expect(result.instrumental).toBe(false)
    expect(result.hasWordSync).toBe(false)
  })
  it.each([
    '[00:01.00]<00:02.00>one<00:01.00>two',
    '[00:01.00]<00:01.00>one<00:01.00>two',
    '[00:01.00]<00:99.00>word',
    '[00:99.00]<01:40.00>word',
    '[00:03.00]<00:03.00>word\n[00:02.00]earlier',
    '[00:01.00]<00:02.00>word\n[00:01.50]next',
    '[00:01.00]<00:01.xx>word',
    '[00:01.00][00:02.00]<00:01.00>word',
    '[00:01.00]unmarked <00:02.00>word',
    '[offset:500]\n[00:01.00]<00:01.00>word',
    'Only plain text',
  ])('rejects ambiguous or invalid enhanced data (%s)', text => {
    expect(() => parseImportedLyrics(text, 'song.elrc')).toThrow()
  })
})

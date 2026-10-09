import { describe, expect, it } from 'vitest'
import { parseImportedLyrics } from './lyrics-import.js'

describe('lyrics file import', () => {
  it('imports plain UTF-8 text with a BOM and Windows newlines without inventing times', () => {
    expect(
      parseImportedLyrics('\uFEFFFirst phrase\r\n[Chorus]\r\nSecond phrase', 'song.txt')
    ).toEqual({ kind: 'plain', plain: 'First phrase\n[Chorus]\nSecond phrase', lines: [] })
  })
  it('recognizes timed TXT, metadata, short minutes and different timestamp precision', () => {
    const result = parseImportedLyrics(
      '[ti:Song]\n[offset:0]\n[0:01.2]first\n[00:02.345]second',
      'song.TXT'
    )
    expect(result.kind).toBe('synced')
    expect(result.plain).toBe('first\nsecond')
    expect(result.lines.map(line => [line.start_ms, line.end_ms])).toEqual([
      [1200, 2345],
      [2345, undefined],
    ])
  })
  it('expands repeated timestamps, sorts chronologically and retains clear markers', () => {
    const result = parseImportedLyrics(
      '[00:03.00][00:01.00]repeat\n[00:02.00]\n[00:04.00]end',
      'song.lrc'
    )
    expect(result.lines.map(line => [line.start_ms, line.text])).toEqual([
      [1000, 'repeat'],
      [2000, ''],
      [3000, 'repeat'],
      [4000, 'end'],
    ])
    expect(result.plain).toBe('repeat\nrepeat\nend')
  })
  it.each([
    ['', 'song.txt'],
    ['words only', 'song.lrc'],
    ['[00:01.xx]bad', 'song.txt'],
    ['[00:01.00]good\nmissing timestamp', 'song.lrc'],
    ['[00:01.00]good\n[00:02.xx]bad', 'song.txt'],
    ['[00:01.00]', 'song.lrc'],
    ['[offset:500]\n[00:01.00]word', 'song.lrc'],
    ['[00:01.00]<00:01.00>word', 'song.lrc'],
  ])(
    'rejects unsupported or incomplete timed content without dropping words (%s)',
    (text, path) => {
      expect(() => parseImportedLyrics(text, path)).toThrow()
    }
  )
})

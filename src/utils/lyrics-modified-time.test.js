import { describe, expect, it } from 'vitest'
import { lyricsModifiedTime } from './lyrics-modified-time.js'

describe('lyric modification display', () => {
  it.each([null, undefined, '', 'not a date'])('does not invent a date for %s', value => {
    expect(lyricsModifiedTime(value)).toBeNull()
  })
  it('displays UTC saves in the viewer local time, with an exact description', () => {
    const value = '2026-10-09T19:23:45.123Z'
    const actual = lyricsModifiedTime(value)
    const date = new Date(value)
    expect(actual.date).toBe(
      date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
    )
    expect(actual.time).toBe(
      date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    )
    expect(actual.description).toBe(`Lyrics last saved in LRCGET: ${date.toLocaleString()}`)
  })
})

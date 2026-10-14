import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { currentLyricIndex, useLyricsFollow } from './useLyricsFollow.js'

const lyrics = () => [
  { text: 'first phrase', start_ms: 1000, end_ms: 2000 },
  { text: 'second phrase', start_ms: 3000, end_ms: 5000 },
  { text: '', start_ms: 5000 },
  { text: 'first phrase', start_ms: 7000, end_ms: 9000 },
]

function fixture() {
  const scope = effectScope()
  const state = {
    lines: ref(lyrics()),
    timeMs: ref(0),
    playing: ref(true),
    enabled: ref(true),
    blocked: ref(false),
    selectedIndex: ref(0),
  }
  state.onSelect = vi.fn(index => {
    state.selectedIndex.value = index
  })
  const result = scope.run(() => useLyricsFollow(state))
  return { ...state, ...result, scope }
}

describe('lyric playback following', () => {
  it('uses half-open cue boundaries and preserves silence/blank clear regions', () => {
    for (const [time, index] of [
      [0, -1],
      [1000, 0],
      [1999, 0],
      [2000, -1],
      [3000, 1],
      [5000, -1],
      [6500, -1],
      [7000, 3],
      [9000, -1],
    ])
      expect(currentLyricIndex(lyrics(), time)).toBe(index)
    expect(currentLyricIndex(lyrics(), NaN)).toBe(-1)
  })
  it('uses timing not repeated wording and supports backward seeking', async () => {
    const state = fixture()
    state.timeMs.value = 3500
    await nextTick()
    expect(state.selectedIndex.value).toBe(1)
    expect(state.enabled.value).toBe(true)
    state.timeMs.value = 7500
    await nextTick()
    expect(state.selectedIndex.value).toBe(3)
    state.timeMs.value = 1500
    await nextTick()
    expect(state.selectedIndex.value).toBe(0)
    state.scope.stop()
  })
  it('does not switch while paused, blocked by editing/looping, or disabled', async () => {
    const state = fixture()
    state.blocked.value = true
    state.timeMs.value = 3500
    await nextTick()
    expect(state.selectedIndex.value).toBe(0)
    state.blocked.value = false
    state.playing.value = false
    await nextTick()
    expect(state.selectedIndex.value).toBe(0)
    state.playing.value = true
    state.enabled.value = false
    await nextTick()
    expect(state.selectedIndex.value).toBe(0)
    state.enabled.value = true
    await nextTick()
    expect(state.selectedIndex.value).toBe(1)
    state.scope.stop()
  })
  it('manual selection pins editing until follow is explicitly enabled', async () => {
    const state = fixture()
    state.timeMs.value = 3500
    await nextTick()
    state.selectedIndex.value = 0
    await nextTick()
    expect(state.enabled.value).toBe(false)
    expect(state.selectedIndex.value).toBe(0)
    state.enabled.value = true
    await nextTick()
    expect(state.selectedIndex.value).toBe(1)
    state.scope.stop()
  })
  it('does not mutate lyric text or word timings while following', async () => {
    const state = fixture()
    state.lines.value[1].words = [{ text: 'second', start_ms: 3000, end_ms: 4000 }]
    const before = JSON.stringify(state.lines.value)
    state.timeMs.value = 3500
    await nextTick()
    expect(JSON.stringify(state.lines.value)).toBe(before)
    state.scope.stop()
  })
  it('ignores untimed rows, picks the latest overlapping cue and handles unsorted rows', () => {
    const rows = [{ text: 'untimed' }, ...lyrics().reverse()]
    expect(rows[currentLyricIndex(rows, 7500)].start_ms).toBe(7000)
    expect(
      currentLyricIndex(
        [
          { text: 'one', start_ms: 1000, end_ms: 9000 },
          { text: 'two', start_ms: 2000, end_ms: 3000 },
        ],
        3500
      )
    ).toBe(-1)
  })
})

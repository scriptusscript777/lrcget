import { describe, expect, it } from 'vitest'
import { scrollToTimelineTime } from './word-timing-viewport.js'

describe('linear word lane scrolling', () => {
  const view = { startMs: 1000, endMs: 5000, width: 1600, visibleWidth: 400, scrollLeft: 0 }
  it('reveals only offscreen times with bounded scroll and preserves linear mapping', () => {
    expect(scrollToTimelineTime({ ...view, timeMs: 1500 })).toBe(0)
    expect(scrollToTimelineTime({ ...view, timeMs: 3000 })).toBe(424)
    expect(scrollToTimelineTime({ ...view, timeMs: 5000 })).toBe(1200)
    expect(scrollToTimelineTime({ ...view, scrollLeft: 1200, timeMs: 1000 })).toBe(0)
    expect(scrollToTimelineTime({ ...view, timeMs: 0 })).toBe(0)
    expect(scrollToTimelineTime({ ...view, timeMs: NaN })).toBe(0)
  })
})

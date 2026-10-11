import { createSSRApp, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import Preview from './WordPlaybackPreview.vue'
import Row from './SyncedLyricsLineRow.vue'

async function setupPreview(line) {
  const props = reactive({ line, allLines: [line], lineIndex: 0, progressMs: 1100, playing: true })
  const emit = vi.fn()
  let state
  await renderToString(
    createSSRApp({
      setup() {
        state = Preview.setup(props, { expose: vi.fn(), emit })
        return () => null
      },
    })
  )
  return { state, props, emit }
}

describe('read-only word playback preview', () => {
  it('matches sentence highlighting through word gaps, pause and loop jumps without mutating timing', async () => {
    const line = {
      text: 'Hello world',
      start_ms: 1000,
      end_ms: 3000,
      words: [
        { text: 'Hello ', start_ms: 1000, end_ms: 1500 },
        { text: 'world', start_ms: 2000, end_ms: 2500 },
      ],
    }
    const original = JSON.stringify(line)
    const { state, props, emit } = await setupPreview(line)
    const active = () => state.previewWords.value.filter(word => word.active).map(word => word.text)
    expect(active()).toEqual(['Hello '])
    props.progressMs = 1500
    expect(active()).toEqual(['Hello '])
    props.progressMs = 2000
    expect(active()).toEqual(['world'])
    props.playing = false
    expect(active()).toEqual(['world'])
    props.progressMs = 2500
    expect(active()).toEqual(['world'])
    props.progressMs = 3000
    expect(active()).toEqual([])
    props.progressMs = 1100 // Existing Loop seeks back; preview follows the same clock.
    expect(active()).toEqual(['Hello '])
    expect(JSON.stringify(line)).toBe(original)
    expect(emit).not.toHaveBeenCalled()
  })

  it('marks unsaved evenly spaced timing and supports untimed or missing selections', async () => {
    const line = { text: 'Hello world', start_ms: 1000, end_ms: 3000 }
    const { state, props } = await setupPreview(line)
    expect(state.hasSavedTiming.value).toBe(false)
    expect(state.previewWords.value.map(word => word.text).join('')).toBe(line.text)
    expect(line.words).toBeUndefined()
    props.line = { text: 'Untimed text' }
    expect(state.previewWords.value).toEqual([])
    props.line = null
    expect(state.previewWords.value).toEqual([])
  })
})

it('matches the sentence row during live start/end edits and marker previews', async () => {
  const line = {
    text: 'Hello world',
    start_ms: 1000,
    end_ms: 3000,
    words: [
      { text: 'Hello ', start_ms: 1000, end_ms: 1500 },
      { text: 'world', start_ms: 2000, end_ms: 2500 },
    ],
  }
  const { state, props } = await setupPreview(line)
  let row
  await renderToString(
    createSSRApp({
      setup() {
        row = Row.setup(props, { expose: vi.fn(), emit: vi.fn() })
        return () => null
      },
    })
  )
  const expectSame = index => {
    expect(state.activeIndex.value).toBe(index)
    expect(row.currentWordIndex.value).toBe(index)
  }
  props.progressMs = 1900
  expectSame(0)
  props.line.words[1].start_ms = 1800
  expectSame(1)
  props.line.words[1].end_ms = 1850
  expectSame(1) // Highlight stays until the next word/sentence boundary.
  props.line.words[1].start_ms = 2200
  expectSame(0)
  props.previewRange = { startMs: 1950, endMs: 2800 }
  expectSame(-1)
  props.progressMs = 2300
  expectSame(1)
  props.progressMs = 2800
  expectSame(-1)
  props.previewRange = null
  props.playing = false
  props.progressMs = 1100
  expectSame(0)
})

it('uses actual word starts without an explicit sentence end and handles inferred ends', async () => {
  const line = {
    text: 'Hello world',
    start_ms: 1000,
    words: [
      { text: 'Hello ', start_ms: 1000 },
      { text: 'world', start_ms: 2000 },
    ],
  }
  const { state, props } = await setupPreview(line)
  props.allLines.push({ text: 'Next', start_ms: 3000 })
  props.progressMs = 2500
  expect(state.activeIndex.value).toBe(1)
  props.progressMs = 3000
  expect(state.activeIndex.value).toBe(-1)
  props.allLines.pop()
  expect(state.activeIndex.value).toBe(1)
  props.progressMs = NaN
  expect(state.activeIndex.value).toBe(-1)
})

it('preserves partially synced starts instead of redistributing them', async () => {
  const line = {
    text: 'Hello new world',
    start_ms: 1000,
    end_ms: 5000,
    words: [
      { text: 'Hello ', start_ms: 1200 },
      { text: 'new ' },
      { text: 'world', start_ms: 4000 },
    ],
  }
  const original = JSON.stringify(line)
  const { state, props } = await setupPreview(line)
  expect(state.hasSavedTiming.value).toBe(false)
  expect(state.hasPartialTiming.value).toBe(true)
  props.progressMs = 1200
  expect(state.activeIndex.value).toBe(0)
  props.progressMs = 4000
  expect(state.activeIndex.value).toBe(2)
  expect(JSON.stringify(line)).toBe(original)
})

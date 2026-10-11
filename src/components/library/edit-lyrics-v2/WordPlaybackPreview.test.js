import { createSSRApp, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import Preview from './WordPlaybackPreview.vue'

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
  it('tracks precise words, silent gaps, pause and loop jumps without mutating timing', async () => {
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
    expect(active()).toEqual([])
    props.progressMs = 2000
    expect(active()).toEqual(['world'])
    props.playing = false
    expect(active()).toEqual(['world'])
    props.progressMs = 2500
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

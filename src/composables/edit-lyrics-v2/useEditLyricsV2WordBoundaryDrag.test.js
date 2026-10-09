import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEditLyricsV2WordBoundaryDrag } from './useEditLyricsV2WordBoundaryDrag.js'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const listeners = new Map()
  vi.stubGlobal('document', {
    addEventListener: (name, handler) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(handler)
    },
    removeEventListener: (name, handler) => listeners.get(name)?.delete(handler),
  })
  const update = vi.fn()
  const replay = vi.fn()
  const words = ref([
    { text: 'first ', start_ms: 1000 },
    { text: 'second', start_ms: 2000 },
  ])
  const state = useEditLyricsV2WordBoundaryDrag({
    isWordSyncAvailable: ref(true),
    words,
    lineStartMs: ref(1000),
    timelineStartMs: ref(1000),
    timelineEndMs: ref(5000),
    selectedLineIndex: ref(0),
    onUpdateWords: update,
    onWordTimingEdited: replay,
  })
  const event = {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
  const send = (type, extra = {}) =>
    [...(listeners.get(type) || [])].forEach(handler => handler({ ...event, ...extra }))
  const start = () => state.startBoundaryDrag(1, event, x => 2000 + (x - 100) * 10)
  return { state, update, replay, words, listeners, send, start }
}

describe('word boundary pointer lifecycle', () => {
  it('does not overwrite sentence lead-in when syncing a later word', () => {
    const fixture = setup()
    fixture.state.selectedBoundaryIndex.value = 1
    expect(fixture.state.syncSelectedBoundary(2200)).toBe(true)
    expect(fixture.update.mock.calls[0][0].lineStartMs).toBeUndefined()
    fixture.state.selectedBoundaryIndex.value = 0
    expect(fixture.state.syncSelectedBoundary(1200)).toBe(true)
    expect(fixture.update.mock.calls[1][0].lineStartMs).toBe(1200)
  })
  it.each([null, NaN, Infinity, -1, undefined])(
    'rejects unavailable playback %s without advancing or changing words',
    value => {
      const fixture = setup()
      const previousIndex = fixture.state.selectedBoundaryIndex.value
      expect(fixture.state.syncSelectedBoundary(value)).toBe(false)
      expect(fixture.state.selectedBoundaryIndex.value).toBe(previousIndex)
      expect(fixture.update).not.toHaveBeenCalled()
    }
  )
  it.each([false, true])(
    'cancels without committing, pending/active=%s, and cleans listeners',
    active => {
      const fixture = setup()
      fixture.start()
      if (active) fixture.send('pointermove', { clientX: 110 })
      fixture.send('pointercancel', { pointerId: 2 })
      expect(fixture.state.dragStartPos.value).not.toBeNull()
      fixture.send('pointercancel')
      fixture.send('pointerup')
      expect(fixture.update).not.toHaveBeenCalled()
      expect(fixture.replay).not.toHaveBeenCalled()
      expect(fixture.state.dragState.value).toBeNull()
      expect([...fixture.listeners.values()].every(set => !set.size)).toBe(true)
    }
  )
  it('ignores other pointers and commits once using the frozen mapping', () => {
    const fixture = setup()
    fixture.start()
    fixture.send('pointermove', { clientX: 120, pointerId: 2 })
    expect(fixture.state.dragState.value).toBeNull()
    fixture.send('pointermove', { clientX: 110 })
    fixture.send('pointermove', { clientX: 120 })
    expect(fixture.words.value[1].start_ms).toBe(2000)
    fixture.send('pointerup', { pointerId: 2 })
    expect(fixture.update).not.toHaveBeenCalled()
    fixture.send('pointerup')
    fixture.send('pointerup')
    expect(fixture.update).toHaveBeenCalledOnce()
    expect(fixture.update.mock.calls[0][0].words[1].start_ms).toBe(2200)
    expect([...fixture.listeners.values()].every(set => !set.size)).toBe(true)
  })
  it('cleans pending and active interactions on explicit teardown', () => {
    const fixture = setup()
    fixture.start()
    fixture.send('pointermove', { clientX: 120 })
    fixture.state.cancelBoundaryInteraction()
    fixture.send('pointerup')
    expect(fixture.update).not.toHaveBeenCalled()
    expect([...fixture.listeners.values()].every(set => !set.size)).toBe(true)
  })
})

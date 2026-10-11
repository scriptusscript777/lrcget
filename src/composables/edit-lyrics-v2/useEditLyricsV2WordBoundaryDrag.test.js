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
  const update = vi.fn(payload => payload.onResult?.(true))
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
  it('keeps sentence markers fixed when syncing any word', () => {
    const fixture = setup()
    fixture.state.selectedBoundaryIndex.value = 1
    expect(fixture.state.syncSelectedBoundary(2200)).toBe(true)
    expect(fixture.update.mock.calls[0][0].lineStartMs).toBeUndefined()
    fixture.state.selectedBoundaryIndex.value = 0
    expect(fixture.state.syncSelectedBoundary(1200)).toBe(true)
    expect(fixture.update.mock.calls[1][0].lineStartMs).toBeUndefined()
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

it('dragging preserves explicit neighboring word ends and silence gaps', () => {
  const fixture = setup()
  fixture.words.value[0].end_ms = 1800
  fixture.words.value[1].end_ms = 2300
  fixture.start()
  fixture.send('pointermove', { clientX: 50 })
  fixture.send('pointerup', { clientX: 50 })
  expect(fixture.update.mock.calls[0][0].words[1].start_ms).toBe(1800)
  fixture.start()
  fixture.send('pointermove', { clientX: 150 })
  fixture.send('pointerup', { clientX: 150 })
  expect(fixture.update.mock.calls[1][0].words[1].start_ms).toBe(2299)
})

it('does not squeeze or move neighboring words when playback lies outside a selected word', () => {
  const f = setup()
  f.state.selectedBoundaryIndex.value = 1
  expect(f.state.syncSelectedBoundary(1000)).toBe(false)
  expect(f.update).not.toHaveBeenCalled()
  expect(f.words.value.map(word => word.start_ms)).toEqual([1000, 2000])
  expect(f.state.selectedBoundaryIndex.value).toBe(1)
})
it('selects a dragged divider and keeps its accepted time on the next Sync instead of stamping stale playback', () => {
  const f = setup()
  f.update.mockImplementation(payload => {
    f.words.value = payload.words
    payload.onResult(true)
  })
  f.start()
  expect(f.state.selectedBoundaryIndex.value).toBe(1)
  f.send('pointermove', { clientX: 120 })
  f.send('pointerup')
  expect(f.words.value[1].start_ms).toBe(2200)
  expect(f.state.syncSelectedBoundary(1000)).toBe(true)
  expect(f.words.value[1].start_ms).toBe(2200)
  expect(f.update).toHaveBeenCalledOnce()
})
it('does not advance or replay a rejected document update', () => {
  const f = setup()
  f.update.mockImplementation(payload => payload.onResult(false))
  expect(f.state.syncSelectedBoundary(1200)).toBe(false)
  expect(f.state.selectedBoundaryIndex.value).toBe(0)
  f.start()
  f.send('pointermove', { clientX: 120 })
  f.send('pointerup')
  expect(f.replay).not.toHaveBeenCalled()
})

it('blocks sync and navigation during a pending or active drag', () => {
  const f = setup()
  f.start()
  expect(f.state.syncSelectedBoundary(2200)).toBe(false)
  expect(f.state.selectPreviousBoundary()).toBe(false)
  f.send('pointermove', { clientX: 120 })
  expect(f.state.syncSelectedBoundary(2200)).toBe(false)
  expect(f.state.selectPreviousBoundary()).toBe(false)
  f.state.resetBoundarySelection()
  expect(f.state.selectedBoundaryIndex.value).toBe(1)
  expect(f.update).not.toHaveBeenCalled()
})

it('distinguishes its accepted document refresh from an external edit', () => {
  const f = setup()
  f.update.mockImplementation(payload => {
    f.words.value = payload.words
    expect(f.state.consumeOwnWordUpdate(f.words.value)).toBe(true)
    payload.onResult(true)
  })
  f.start()
  f.send('pointermove', { clientX: 120 })
  f.send('pointerup')
  expect(f.state.isDraggingBoundary.value).toBe(true)
  f.state.selectBoundary(0)
  expect(f.state.selectedBoundaryIndex.value).toBe(1)
  expect(f.state.consumeOwnWordUpdate([{ text: 'changed', start_ms: 1000 }])).toBe(false)
})

it('keeps an accepted numeric edit on Sync and invalidates it after Undo', () => {
  const f = setup()
  f.words.value[0].start_ms = 1200
  f.state.rememberAdjustedBoundary(0, f.words.value)
  expect(f.state.syncSelectedBoundary(1800)).toBe(true)
  expect(f.update).not.toHaveBeenCalled()
  expect(f.state.selectedBoundaryIndex.value).toBe(0)
  f.state.rememberAdjustedBoundary(0, f.words.value)
  f.words.value[0].start_ms = 1000
  expect(f.state.hasAdjustedBoundary.value).toBe(false)
  expect(f.state.syncSelectedBoundary(1500)).toBe(true)
  expect(f.update.mock.calls[0][0].words[0].start_ms).toBe(1500)
})

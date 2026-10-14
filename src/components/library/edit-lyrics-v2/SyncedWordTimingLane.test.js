import * as Vue from 'vue'
import { createRenderer, nextTick, reactive, ssrContextKey } from 'vue'
import { compile } from '@vue/compiler-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Lane from './SyncedWordTimingLane.vue'
import Segment from './SyncedWordTimingSegment.vue'
import { wordTimingFingerprint } from '@/utils/word-timing-state.js'
import { hasMeasuredWordTiming } from '@/utils/word-timing-status.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue([]) }))
// The in-memory renderer has no DOM; browser checks cover native descriptions.
vi.mock('@/utils/editor-tooltip.js', () => ({
  vTooltip: {},
  editorTooltip: content => ({ content }),
}))
const apps = []
beforeEach(() => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  vi.unstubAllGlobals()
})

function mount(component) {
  const node = type => ({ type, children: [], props: {}, parent: null, text: '' })
  const renderer = createRenderer({
    createElement: node,
    createComment: () => node('#comment'),
    createText: text => ({ ...node('#text'), text }),
    setText: (element, text) => {
      element.text = text
    },
    setElementText: (element, text) => {
      element.text = text
    },
    patchProp: (element, key, _previous, value) => {
      element.props[key] = value
    },
    insert(element, parent, anchor = null) {
      if (element.parent)
        element.parent.children.splice(element.parent.children.indexOf(element), 1)
      element.parent = parent
      const index = parent.children.indexOf(anchor)
      parent.children.splice(index < 0 ? parent.children.length : index, 0, element)
    },
    remove(element) {
      if (element.parent)
        element.parent.children.splice(element.parent.children.indexOf(element), 1)
      element.parent = null
    },
    parentNode: element => element.parent,
    nextSibling: element =>
      element.parent?.children[element.parent.children.indexOf(element) + 1] || null,
  })
  const root = node('root')
  const app = renderer.createApp(component)
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount(root)
  apps.push(app)
  return { app, root }
}

function setupLane({
  generated = false,
  initialWordIndex = 0,
  applyUpdates = false,
  confirmedWordTimings = [],
  adjustedWordTimings = [],
} = {}) {
  const line = {
    text: generated ? 'I sing ' : ' I sing ',
    start_ms: 1000,
    end_ms: 3000,
    ...(!generated && {
      words: [
        { text: ' I ', start_ms: 1000 },
        { text: 'sing ', start_ms: 1500 },
      ],
    }),
  }
  const props = reactive({
    selectedLine: line,
    selectedLineIndex: 0,
    hasSelectedLine: true,
    initialWordIndex,
    confirmedWordTimings,
    adjustedWordTimings,
    allLines: [line],
    progressMs: 1100,
    playing: true,
    wordLoopEnabled: false,
    sentenceLoopEnabled: false,
  })
  let state
  const emit = vi.fn((event, payload) => {
    if (!applyUpdates || event !== 'update:words') return
    props.selectedLine = { ...props.selectedLine, words: payload.words }
    props.allLines = [props.selectedLine]
    payload.onResult?.(true)
  })
  const mounted = mount({
    setup() {
      state = Lane.setup(props, { expose: vi.fn(), emit })
      return () => null
    },
  })
  return { ...mounted, props, state, emit }
}

const { descriptor } = parse(
  readFileSync(new URL('./SyncedWordTimingSegment.vue', import.meta.url), 'utf8')
)
const { code } = compile(descriptor.template.content, {
  mode: 'function',
  prefixIdentifiers: true,
  bindingMetadata: compileScript(descriptor, { id: 'word-edit-test' }).bindings,
})
const segment = { ...Segment, render: new Function('Vue', code)(Vue) }

describe('read-only word boxes', () => {
  it('selects a narrow word without exposing spelling or split actions', () => {
    const select = vi.fn()
    const { root } = mount({
      render: () =>
        Vue.h(segment, {
          word: { text: 'I' },
          wordIndex: 2,
          startMs: 1000,
          endMs: 1010,
          lineStartMs: 1000,
          lineEndMs: 3000,
          timelineWidth: 200,
          onSelectWord: select,
        }),
    })
    const box = root.children[0]
    expect(box.props['aria-label']).toBe('Select word 3: I')
    expect(box.props.onContextmenu).toBeUndefined()
    box.props.onFocus()
    expect(select).toHaveBeenCalledWith(2, false)
    box.props.onClick({ stopPropagation: vi.fn() })
    expect(select).toHaveBeenLastCalledWith(2, true)
    expect(stateNames()).not.toContain('startWordTextEdit')
  })
})
const stateNames = () => Object.keys(setupLane().state)

describe('word loop precision controls', () => {
  it('word selection also selects the keyboard timing boundary and emits a loop target', async () => {
    const { state, emit, props } = setupLane()
    props.wordLoopEnabled = true
    state.selectWord(1)
    await nextTick()
    expect(state.selectedWordIndex.value).toBe(1)
    expect(state.selectedBoundaryIndex.value).toBe(1)
    expect(emit).toHaveBeenCalledWith('seek-word', { startMs: 1500 })
    expect(emit).toHaveBeenCalledWith(
      'word-loop-target',
      expect.objectContaining({
        line: props.selectedLine,
        lineIndex: 0,
        wordIndex: 1,
        startMs: 1500,
        endMs: 3000,
      })
    )
  })
  it('paused word selection seeks to that word and Play resumes from it', () => {
    const { state, emit, props } = setupLane()
    props.playing = false
    props.sentenceLoopEnabled = true
    state.selectWord(1)
    expect(emit).toHaveBeenCalledWith('seek-word', { startMs: 1500 })
    state.selectWord(1, false)
    state.handlePlaySelectedWord()
    expect(emit).toHaveBeenCalledWith('play-word', { startMs: 1500 })
  })
  it.each([false, true])('seeks to a clicked word with loops off and playing=%s', playing => {
    const { state, emit, props } = setupLane()
    props.playing = playing
    state.selectWord(1)
    expect(emit).toHaveBeenCalledWith('seek-word', { startMs: 1500 })
    expect(props.playing).toBe(playing)
  })
  it('editing a precise end emits preserved word text and clamps against its neighbor', async () => {
    const { state, emit } = setupLane({ applyUpdates: true })
    state.selectWord(0)
    state.editSelectedBoundary('end', { target: { value: '1.400' } })
    expect(emit).toHaveBeenCalledWith(
      'update:words',
      expect.objectContaining({
        words: [
          { text: ' I ', start_ms: 1000, end_ms: 1400 },
          { text: 'sing ', start_ms: 1500 },
        ],
      })
    )
    await nextTick()
  })
  it('does not light Sync when a timing field is left unchanged', async () => {
    const { state, emit } = setupLane({ applyUpdates: true })
    state.selectWord(0)
    state.editSelectedBoundary('start', { target: { value: '1.000' } })
    await nextTick()
    expect(state.hasAdjustedBoundary.value).toBe(false)
    expect(state.isSyncAdjustmentActive.value).toBe(false)
    expect(emit).not.toHaveBeenCalledWith('update:words', expect.anything())
  })
  it('sync confirms a manually moved boundary without shrinking or relocating its word box', async () => {
    const { state, props, emit } = setupLane({ applyUpdates: true })
    props.wordLoopEnabled = true
    state.selectWord(1)
    state.editSelectedBoundary('start', { target: { value: '1.800' } })
    await nextTick()
    props.progressMs = 1601
    state.handleSyncWord()
    expect(state.selectedWordIndex.value).toBe(1)
    expect(state.selectedBoundaryIndex.value).toBe(1)
    expect(emit).not.toHaveBeenCalledWith('select-next-line')
    expect(props.selectedLine.words[1].start_ms).toBe(1800)
    expect(state.isManualTimingConfirmed.value).toBe(true)
    expect(emit.mock.calls.filter(([event]) => event === 'update:words')).toHaveLength(1)
    await nextTick()
  })
})

it('restores the selected word when the word lane is reopened', async () => {
  const { state } = setupLane({ initialWordIndex: 1 })
  await nextTick()
  expect(state.selectedWordIndex.value).toBe(1)
  expect(state.selectedBoundaryIndex.value).toBe(1)
})

it('hydrates confirmed Sync state when recovery arrives after the lane mounts', async () => {
  const { state, props } = setupLane()
  props.confirmedWordTimings = [
    ['0:0', wordTimingFingerprint(0, [{ text: ' I ', start_ms: 1000 }], 0)],
  ]
  await nextTick()
  state.selectWord(0)
  expect(state.isManualTimingConfirmed.value).toBe(true)
})

it('lights Sync for the word whose timing field was edited after selection settles', async () => {
  const { state } = setupLane({ applyUpdates: true })
  // Simulate a pending UI selection update: the time field points to word 2,
  // while the boundary selection still temporarily points to word 1.
  state.selectedWordIndex.value = 1
  state.selectedBoundaryIndex.value = 0

  state.editSelectedBoundary('start', { target: { value: '1.600' } })
  await nextTick()

  expect(state.selectedWordIndex.value).toBe(1)
  expect(state.selectedBoundaryIndex.value).toBe(1)
  expect(state.hasAdjustedBoundary.value).toBe(true)
  expect(state.isSyncAdjustmentActive.value).toBe(true)
})

it('emits and restores confirmed Sync word state when the lane is reopened', async () => {
  const first = setupLane({ applyUpdates: true })
  first.state.selectWord(0)
  first.state.editSelectedBoundary('start', { target: { value: '1.100' } })
  await nextTick()
  expect(first.state.hasAdjustedBoundary.value).toBe(true)
  expect(first.state.isSyncAdjustmentActive.value).toBe(true)
  first.state.selectWord(1)
  first.state.editSelectedBoundary('start', { target: { value: '1.700' } })
  await nextTick()
  expect(first.state.hasPendingAdjustedBoundaries.value).toBe(true)
  first.props.wordLoopEnabled = true
  first.props.progressMs = 1200
  first.state.handleSyncWord()
  await nextTick()
  const confirmed = first.emit.mock.calls
    .filter(([event]) => event === 'confirmed-word-timings-change')
    .at(-1)?.[1]
  expect(confirmed).toEqual([
    ['0:0', expect.any(String)],
    ['0:1', expect.any(String)],
  ])
  expect(first.state.hasPendingAdjustedBoundaries.value).toBe(false)
  expect(first.props.selectedLine.words.map(word => word.start_ms)).toEqual([1100, 1700])

  const reopened = setupLane({
    confirmedWordTimings: confirmed,
    initialWordIndex: 0,
  })
  reopened.props.selectedLine.words = first.props.selectedLine.words.map(word => ({ ...word }))
  reopened.props.allLines = [reopened.props.selectedLine]
  await nextTick()
  reopened.state.selectWord(0)
  expect(reopened.state.isManualTimingConfirmed.value).toBe(true)
})

it('shows sentence-wide Sync for any adjusted word and restores it across a resumed session', async () => {
  const first = setupLane({ applyUpdates: true })
  first.state.selectWord(0)
  first.state.editSelectedBoundary('start', { target: { value: '1.100' } })
  await nextTick()
  expect(first.state.hasAdjustedBoundary.value).toBe(true)

  const secondLine = {
    text: 'we go',
    start_ms: 3000,
    end_ms: 5000,
    words: [
      { text: 'we ', start_ms: 3000 },
      { text: 'go', start_ms: 4000 },
    ],
  }
  first.props.allLines = [first.props.selectedLine, secondLine]
  first.props.selectedLineIndex = 1
  first.props.selectedLine = secondLine
  await nextTick()
  first.state.selectWord(0)
  expect(first.state.hasAdjustedBoundary.value).toBe(false)

  first.props.selectedLineIndex = 0
  first.props.selectedLine = first.props.allLines[0]
  await nextTick()
  expect(first.state.hasAdjustedBoundary.value).toBe(true)
  expect(first.state.isSyncAdjustmentActive.value).toBe(true)

  const pending = first.emit.mock.calls
    .filter(([event]) => event === 'adjusted-word-timings-change')
    .at(-1)?.[1]
  expect(pending).toEqual([['0:0', expect.any(String)]])
  const resumed = setupLane({ adjustedWordTimings: pending, initialWordIndex: 0, applyUpdates: true })
  resumed.props.selectedLine.words = first.props.selectedLine.words.map(word => ({ ...word }))
  resumed.props.allLines = [resumed.props.selectedLine]
  await nextTick()
  expect(resumed.state.hasAdjustedBoundary.value).toBe(true)
  expect(resumed.state.isSyncAdjustmentActive.value).toBe(true)
  const originalStarts = resumed.props.selectedLine.words.map(word => word.start_ms)
  resumed.state.handleSyncWord()
  await nextTick()
  expect(resumed.props.selectedLine.words.map(word => word.start_ms)).toEqual(originalStarts)
  expect(resumed.state.isManualTimingConfirmed.value).toBe(true)
  expect(resumed.state.hasPendingAdjustedBoundaries.value).toBe(false)
})

it('Reset submits an empty word list that the document handler accepts', async () => {
  const { state, emit } = setupLane({ applyUpdates: true })
  await state.handleResetWords()
  expect(emit).toHaveBeenCalledWith(
    'update:words',
    expect.objectContaining({ lineIndex: 0, words: [] })
  )
})

it('precise first-word edits do not move the sentence start or prevent tuning back', async () => {
  const { state, props, emit } = setupLane()
  state.selectWord(0)
  state.editSelectedBoundary('start', { target: { value: '1.010' } })
  const first = emit.mock.calls.filter(([event]) => event === 'update:words').at(-1)[1]
  expect(first.lineStartMs).toBeUndefined()
  props.selectedLine.words = first.words
  await nextTick()
  state.editSelectedBoundary('start', { target: { value: '1.000' } })
  const restored = emit.mock.calls.filter(([event]) => event === 'update:words').at(-1)[1]
  expect(restored.words[0].start_ms).toBe(1000)
  expect(props.selectedLine.start_ms).toBe(1000)
  await nextTick()
})

it('enables sentence-wide Sync after any word changes and clears it only after syncing all', async () => {
  const { state, emit, props } = setupLane({ applyUpdates: true })
  state.selectWord(0)
  expect(state.hasAdjustedBoundary.value).toBe(false)
  expect(state.isSyncAdjustmentActive.value).toBe(false)

  state.editSelectedBoundary('start', { target: { value: '1.100' } })
  await nextTick()
  expect(state.hasAdjustedBoundary.value).toBe(true)
  expect(state.isSyncAdjustmentActive.value).toBe(true)

  state.selectWord(1)
  expect(state.hasAdjustedBoundary.value).toBe(false)
  expect(state.isSyncAdjustmentActive.value).toBe(true)
  const timingBeforeSync = props.selectedLine.words.map(word => word.start_ms)
  state.handleSyncWord()
  await nextTick()
  expect(props.selectedLine.words.map(word => word.start_ms)).toEqual(timingBeforeSync)
  expect(state.hasPendingAdjustedBoundaries.value).toBe(false)
  expect(state.isSyncAdjustmentActive.value).toBe(false)

  state.editSelectedBoundary('start', { target: { value: '1.700' } })
  await nextTick()
  expect(state.hasPendingAdjustedBoundaries.value).toBe(true)
  expect(state.isSyncAdjustmentActive.value).toBe(true)
  expect(emit).not.toHaveBeenCalledWith('update:words', expect.objectContaining({ lineIndex: 0, words: [] }))

  props.selectedLineIndex = 1
  await nextTick()
  expect(state.isSyncAdjustmentActive.value).toBe(false)
})
it('Follow off holds a zoomed word timeline through progress and pause/resume', async () => {
  const { state, props } = setupLane()
  await nextTick()
  state.scrollElement.value = { clientWidth: 200, scrollLeft: 0 }
  state.timelineWidth.value = 1000
  props.followLyrics = false
  props.progressMs = 2800
  await nextTick()
  expect(state.scrollElement.value.scrollLeft).toBe(0)
  props.playing = false
  await nextTick()
  props.playing = true
  await nextTick()
  expect(state.scrollElement.value.scrollLeft).toBe(0)
  props.followLyrics = true
  await nextTick()
  expect(state.scrollElement.value.scrollLeft).toBeGreaterThan(0)
})

it('rejected Reset keeps the word document and confirmation intact', async () => {
  const { state, props } = setupLane()
  const snapshot = JSON.stringify(props.selectedLine)
  await state.handleResetWords()
  expect(JSON.stringify(props.selectedLine)).toBe(snapshot)
  expect(state.timingMessage.value).toContain('not reset')
})

describe('accepting estimated word timings', () => {
  it('saves the displayed estimates without changing their positions', async () => {
    const { state, props, emit } = setupLane({ generated: true, applyUpdates: true })
    expect(state.canAcceptEstimatedTimings.value).toBe(true)
    const expectedWords = state.words.value.map(word => ({ ...word }))

    expect(state.handleAcceptEstimatedTimings()).toBe(true)
    expect(emit).toHaveBeenCalledWith('update:words', {
      lineIndex: 0,
      words: expectedWords,
    })
    expect(props.selectedLine.words).toEqual(expectedWords)
    expect(hasMeasuredWordTiming(props.selectedLine)).toBe(true)
    await nextTick()
    expect(state.canAcceptEstimatedTimings.value).toBe(false)
  })

  it('is unavailable once word timing is stored or awaiting Sync words', async () => {
    const { state, props } = setupLane({ generated: true, applyUpdates: true })
    state.selectWord(1)
    state.editSelectedBoundary('start', { target: { value: '2.100' } })
    await nextTick()

    expect(state.hasPendingAdjustedBoundaries.value).toBe(true)
    expect(state.canAcceptEstimatedTimings.value).toBe(false)
    expect(state.handleAcceptEstimatedTimings()).toBe(false)
    expect(props.selectedLine.words).toBeDefined()

    state.handleSyncWord()
    await nextTick()
    expect(state.isManualTimingConfirmed.value).toBe(true)
    expect(state.canAcceptEstimatedTimings.value).toBe(false)
  })

  it('offers the action again for the next sentence after accepting the current one', async () => {
    const { state, props } = setupLane({ generated: true, applyUpdates: true })
    const nextLine = {
      text: 'we go',
      start_ms: 3000,
      end_ms: 5000,
    }
    props.allLines = [props.selectedLine, nextLine]

    expect(state.handleAcceptEstimatedTimings()).toBe(true)
    await nextTick()
    expect(state.canAcceptEstimatedTimings.value).toBe(false)

    props.selectedLineIndex = 1
    props.selectedLine = nextLine
    await nextTick()
    expect(state.canAcceptEstimatedTimings.value).toBe(true)
    expect(state.words.value.map(word => word.text).join('')).toBe(nextLine.text)
  })
})

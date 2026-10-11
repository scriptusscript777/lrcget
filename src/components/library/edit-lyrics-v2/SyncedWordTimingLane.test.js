import * as Vue from 'vue'
import { createRenderer, nextTick, reactive, ssrContextKey } from 'vue'
import { compile } from '@vue/compiler-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Lane from './SyncedWordTimingLane.vue'
import Segment from './SyncedWordTimingSegment.vue'

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

function setupLane({ generated = false, initialWordIndex = 0 } = {}) {
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
    allLines: [line],
    progressMs: 1100,
    playing: true,
  })
  let state
  const emit = vi.fn()
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
    box.props.onDblclick({ stopPropagation: vi.fn() })
    expect(select).toHaveBeenCalledWith(2)
    expect(stateNames()).not.toContain('startWordTextEdit')
  })
})
const stateNames = () => Object.keys(setupLane().state)

describe('word loop precision controls', () => {
  it('word selection also selects the keyboard timing boundary and emits a loop target', async () => {
    const { state, emit, props } = setupLane()
    state.selectWord(1)
    await nextTick()
    expect(state.selectedWordIndex.value).toBe(1)
    expect(state.selectedBoundaryIndex.value).toBe(1)
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
  it('editing a precise end emits preserved word text and clamps against its neighbor', async () => {
    const { state, emit } = setupLane()
    state.selectWord(0)
    state.editSelectedBoundary('end', { target: { value: '2.000' } })
    expect(emit).toHaveBeenCalledWith(
      'update:words',
      expect.objectContaining({
        words: [
          { text: ' I ', start_ms: 1000, end_ms: 1500 },
          { text: 'sing ', start_ms: 1500 },
        ],
      })
    )
    await nextTick()
  })
  it('sync while word looping keeps the selected word and does not advance the sentence', async () => {
    const { state, props, emit } = setupLane()
    props.wordLoopEnabled = true
    state.selectWord(1)
    await nextTick()
    props.progressMs = 1700
    state.handleSyncWord()
    expect(state.selectedWordIndex.value).toBe(1)
    expect(state.selectedBoundaryIndex.value).toBe(1)
    expect(emit).not.toHaveBeenCalledWith('select-next-line')
    expect(emit).toHaveBeenCalledWith(
      'update:words',
      expect.objectContaining({
        words: [
          { text: ' I ', start_ms: 1000 },
          { text: 'sing ', start_ms: 1700 },
        ],
      })
    )
    await nextTick()
  })
})

it('restores the selected word when the word lane is reopened', async () => {
  const { state } = setupLane({ initialWordIndex: 1 })
  await nextTick()
  expect(state.selectedWordIndex.value).toBe(1)
  expect(state.selectedBoundaryIndex.value).toBe(1)
})

it('Reset submits an empty word list that the document handler accepts', async () => {
  const { state, emit } = setupLane()
  await state.handleResetWords()
  expect(emit).toHaveBeenCalledWith('update:words', { lineIndex: 0, words: [] })
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

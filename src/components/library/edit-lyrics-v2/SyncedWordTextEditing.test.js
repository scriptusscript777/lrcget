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
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
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
    setText: (element, text) => { element.text = text },
    setElementText: (element, text) => { element.text = text },
    patchProp: (element, key, _previous, value) => { element.props[key] = value },
    insert(element, parent, anchor = null) {
      if (element.parent) element.parent.children.splice(element.parent.children.indexOf(element), 1)
      element.parent = parent
      const index = parent.children.indexOf(anchor)
      parent.children.splice(index < 0 ? parent.children.length : index, 0, element)
    },
    remove(element) {
      if (element.parent) element.parent.children.splice(element.parent.children.indexOf(element), 1)
      element.parent = null
    },
    parentNode: element => element.parent,
    nextSibling: element => element.parent?.children[element.parent.children.indexOf(element) + 1] || null,
  })
  const root = node('root')
  const app = renderer.createApp(component)
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount(root)
  apps.push(app)
  return { app, root }
}

function setupLane({ generated = false } = {}) {
  const line = {
    text: generated ? 'I sing ' : ' I sing ', start_ms: 1000, end_ms: 3000,
    ...(!generated && { words: [{ text: ' I ', start_ms: 1000 }, { text: 'sing ', start_ms: 1500 }] }),
  }
  const props = reactive({
    selectedLine: line, selectedLineIndex: 0, hasSelectedLine: true,
    allLines: [line], progressMs: 1100, playing: true,
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

describe('inline word text editing', () => {
  it('edits a short word explicitly, strips input padding, and emits unchanged timing/source data', async () => {
    const { state, props, emit } = setupLane()
    const original = JSON.stringify(props.selectedLine)
    await state.startWordTextEdit(0)
    expect(state.wordText.value).toBe('I')
    expect(emit).toHaveBeenCalledWith('editing-change', true)
    expect(emit).toHaveBeenCalledWith('word-text-editing-start')
    state.wordText.value = 'We'
    state.applyWordTextEdit()
    expect(emit).toHaveBeenCalledWith('edit-word-text', {
      lineIndex: 0, line: props.selectedLine, wordIndex: 0,
      text: 'We', words: state.words.value,
    })
    expect(JSON.stringify(props.selectedLine)).toBe(original)
    expect(state.words.value[0].text).toBe(' I ')
    expect(state.wordTextEdit.value).toBeNull()
    expect(emit).toHaveBeenCalledWith('editing-change', false)
    expect(emit).not.toHaveBeenCalledWith('update:words', expect.anything())
    state.applyWordTextEdit()
    expect(emit.mock.calls.filter(([event]) => event === 'edit-word-text')).toHaveLength(1)
  })

  it('does not save on blur and cancels without mutations', async () => {
    const { state, emit } = setupLane()
    await state.startWordTextEdit(1)
    state.wordText.value = 'sang'
    window.addEventListener.mock.calls.find(([event]) => event === 'blur')[1]()
    expect(state.wordTextEdit.value).not.toBeNull()
    expect(emit).not.toHaveBeenCalledWith('edit-word-text', expect.anything())
    state.cancelWordTextEdit()
    state.applyWordTextEdit()
    expect(state.wordText.value).toBe('')
    expect(emit).not.toHaveBeenCalledWith('edit-word-text', expect.anything())
  })

  it.each(['', 'two words', ' padded', 'line\nbreak'])('rejects invalid replacement %j', async text => {
    const { state, emit } = setupLane()
    await state.startWordTextEdit(0)
    state.wordText.value = text
    expect(state.canApplyWordText.value).toBe(false)
    state.applyWordTextEdit()
    expect(emit).not.toHaveBeenCalledWith('edit-word-text', expect.anything())
  })

  it.each(['index', 'identity', 'text', 'words', 'timing', 'line-timing', 'document'])(
    'cancels synchronously when the source changes: %s', async change => {
      const { state, props, emit } = setupLane()
      await state.startWordTextEdit(0)
      state.wordText.value = 'We'
      if (change === 'index') props.selectedLineIndex = 1
      if (change === 'identity') props.selectedLine = { ...props.selectedLine }
      if (change === 'text') props.selectedLine.text = 'Other line'
      if (change === 'words') props.selectedLine.words[0].text = ' You '
      if (change === 'timing') props.selectedLine.words[0].start_ms = 1200
      if (change === 'line-timing') props.selectedLine.end_ms = 4000
      if (change === 'document') props.allLines = [...props.allLines]
      expect(state.wordTextEdit.value).toBeNull()
      state.applyWordTextEdit()
      expect(emit).not.toHaveBeenCalledWith('edit-word-text', expect.anything())
    }
  )

  it('supports generated word timings without persisting or replacing them while opening the form', async () => {
    const { state, props, emit } = setupLane({ generated: true })
    await nextTick()
    await state.startWordTextEdit(0)
    state.wordText.value = 'We'
    const words = state.words.value
    state.applyWordTextEdit()
    expect(emit).toHaveBeenCalledWith('edit-word-text', {
      lineIndex: 0, line: props.selectedLine, wordIndex: 0, text: 'We', words,
    })
    expect(props.selectedLine.words).toBeUndefined()
  })

  it('blocks split and timing mutations while editing and releases its editing guard on unmount', async () => {
    const { state, emit, app } = setupLane()
    await state.startWordTextEdit(0)
    state.handleSegmentSplitAt({ wordIndex: 1, splitIndex: 1, splitRatio: 0.5 })
    state.handleResetWords()
    state.handleSyncWord()
    state.handleDeleteSelectedBoundaries()
    expect(emit).not.toHaveBeenCalledWith('update:words', expect.anything())
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    expect(emit).toHaveBeenLastCalledWith('editing-change', false)
  })
})

const { descriptor } = parse(readFileSync(new URL('./SyncedWordTimingSegment.vue', import.meta.url), 'utf8'))
const { code } = compile(descriptor.template.content, {
  mode: 'function', prefixIdentifiers: true,
  bindingMetadata: compileScript(descriptor, { id: 'word-edit-test' }).bindings,
})
const segment = { ...Segment, render: new Function('Vue', code)(Vue) }

describe('word box edit entry points', () => {
  it('makes even a narrow single-letter box focusable and editable with F2 or right-click', async () => {
    const edit = vi.fn()
    const select = vi.fn()
    const { root } = mount({
      render: () => Vue.h(segment, {
        word: { text: 'I' }, wordIndex: 2, startMs: 1000, endMs: 1010,
        lineStartMs: 1000, lineEndMs: 3000, timelineWidth: 200,
        onEditWord: edit, onSelectWord: select,
      }),
    })
    const box = root.children[0]
    expect(box.props.tabindex).toBe('0')
    expect(box.props['aria-label']).toContain('Edit with F2')
    const event = { key: 'F2', preventDefault: vi.fn(), stopPropagation: vi.fn() }
    box.props.onKeydown.forEach(handler => handler(event))
    box.props.onContextmenu(event)
    expect(edit.mock.calls).toEqual([[2], [2]])
    expect(select.mock.calls).toEqual([[2], [2]])
  })
})

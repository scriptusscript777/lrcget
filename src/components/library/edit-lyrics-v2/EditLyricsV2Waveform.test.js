import * as Vue from 'vue'
import { createRenderer, h, nextTick, reactive, ssrContextKey } from 'vue'
import { compile } from '@vue/compiler-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import EditLyricsV2Waveform from './EditLyricsV2Waveform.vue'
import {
  resetAllShortcutOverrides,
  setShortcutOverride,
} from '@/composables/edit-lyrics-v2/shortcutRegistry.js'

// Vitest loads SFCs in SSR mode. Compile the same template for the in-memory client renderer.
const { descriptor } = parse(
  readFileSync(new URL('./EditLyricsV2Waveform.vue', import.meta.url), 'utf8')
)
const { code } = compile(descriptor.template.content, {
  mode: 'function',
  prefixIdentifiers: true,
  bindingMetadata: compileScript(descriptor, { id: 'waveform-test' }).bindings,
})
const component = { ...EditLyricsV2Waveform, render: new Function('Vue', code)(Vue) }

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
const data = { duration: 120, secondsPerPeak: 1, peaks: Array(120).fill(0.5) }
const apps = []
const frames = new Map()
const observers = []
let nextFrame

beforeEach(() => {
  vi.resetAllMocks()
  invoke.mockResolvedValue(data)
  nextFrame = 0
  frames.clear()
  observers.length = 0
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn(id => frames.delete(id))
  )
  class Observer {
    constructor(callback) {
      this.callback = callback
      observers.push(this)
    }
    observe = vi.fn()
    disconnect = vi.fn()
  }
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('MutationObserver', Observer)
  vi.stubGlobal('window', {
    devicePixelRatio: 2,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('document', { documentElement: { classList: { contains: () => false } } })
  vi.stubGlobal('getComputedStyle', () => ({ fontFamily: 'sans-serif' }))
})
afterEach(() => {
  resetAllShortcutOverrides()
  apps.splice(0).forEach(app => app.unmount())
  vi.unstubAllGlobals()
})

async function mount(initial = {}) {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }
  const node = type => ({
    type,
    children: [],
    props: {},
    text: '',
    parent: null,
    getBoundingClientRect: () => ({ width: 400, left: 20 }),
    getContext: () => context,
  })
  // Exercise the compiled component's rendered controls/events without a DOM dependency.
  const renderer = createRenderer({
    createElement: node,
    createComment: () => node('#comment'),
    createText: text => ({ ...node('#text'), text }),
    setText: (element, text) => {
      element.text = text
    },
    setElementText: (element, text) => {
      element.text = text
      element.children = []
    },
    patchProp: (element, key, previous, value) => {
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
  const props = reactive({ audioSource: { type: 'library', id: 1 }, progress: 30, ...initial })
  const seek = vi.fn()
  const updateMarkers = vi.fn()
  const app = renderer.createApp({
    render: () => h(component, { ...props, onSeek: seek, onUpdateMarkers: updateMarkers }),
  })
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount(root)
  apps.push(app)
  await nextTick()
  const all = (element = root) => [element, ...element.children.flatMap(child => all(child))]
  const byId = id => all().find(element => element.props['data-testid'] === id)
  const byLabel = label => all().find(element => element.props['aria-label'] === label)
  const text = (element = root) =>
    element.text + element.children.map(child => text(child)).join('')
  const draw = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(callback => callback())
  }
  return { app, props, seek, updateMarkers, all, byId, byLabel, text, draw, context }
}

describe('waveform controls and states', () => {
  const key = (state, boundary, value, shiftKey = false) =>
    state.byId(`waveform-marker-${boundary}`).props.onKeydown({
      key: value,
      shiftKey,
      preventDefault: vi.fn(),
    })
  const escape = state =>
    state.byId('editor-waveform').props.onKeydown({
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

  it('validates translated words and applies both draft markers in one event', async () => {
    const line = {
      start_ms: 1000,
      end_ms: 3000,
      words: [{ start_ms: 1200, end_ms: 2500 }],
    }
    const state = await mount({ selectedLine: line, selectedLineIndex: 4 })
    expect(state.byId('waveform-apply-markers')).toBeUndefined()
    key(state, 'start', 'End')
    await nextTick()
    // The translated word end equals the unchanged draft lyric end.
    expect(state.byId('waveform-marker-start').props['aria-valuenow']).toBe(1500)
    expect(state.byId('waveform-marker-end').props['aria-valuemin']).toBe(3000)
    key(state, 'end', 'ArrowRight')
    await nextTick()
    key(state, 'start', 'ArrowLeft')
    await nextTick()
    expect(state.byId('waveform-marker-end').props['aria-valuenow']).toBe(3100)
    expect(state.props.selectedLine).toEqual(line)
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.byId('waveform-apply-markers').props.class).toContain('bg-hoa-1500')
    expect(state.byId('waveform-apply-markers').props.class).toContain('text-white')
    expect(state.byId('waveform-apply-markers').props.class).toContain('dark:hover:bg-hoa-1400')
    state.byId('waveform-apply-markers').props.onClick()
    expect(state.updateMarkers).toHaveBeenCalledExactlyOnceWith({
      lineIndex: 4,
      line: state.props.selectedLine,
      startMs: 1400,
      endMs: 3100,
      durationMs: 120000,
    })
    expect(state.updateMarkers.mock.calls[0][0].line).toBe(state.props.selectedLine)
    expect(state.seek).not.toHaveBeenCalled()
  })

  it.each(['button', 'escape', 'return-to-original'])(
    'discards the draft with %s without touching media or document',
    async mode => {
      const state = await mount({
        selectedLine: { start_ms: 1000, end_ms: 3000 },
        selectedLineIndex: 0,
      })
      key(state, 'start', 'ArrowRight')
      await nextTick()
      if (mode === 'button') state.byId('waveform-cancel-markers').props.onClick()
      else if (mode === 'escape') escape(state)
      else key(state, 'start', 'ArrowLeft')
      await nextTick()
      expect(state.byId('waveform-apply-markers')).toBeUndefined()
      expect(state.byId('waveform-marker-start').props['aria-valuenow']).toBe(1000)
      expect(state.updateMarkers).not.toHaveBeenCalled()
      expect(state.seek).not.toHaveBeenCalled()
    }
  )

  it.each(['pointercancel', 'lostpointercapture', 'escape'])(
    'restores the prior draft after drag %s and disables confirmation during drag',
    async mode => {
      const state = await mount({
        selectedLine: { start_ms: 1000, end_ms: 3000 },
        selectedLineIndex: 0,
      })
      key(state, 'start', 'ArrowRight')
      await nextTick()
      const marker = state.byId('waveform-marker-start')
      marker.setPointerCapture = vi.fn()
      marker.hasPointerCapture = () => true
      marker.releasePointerCapture = vi.fn()
      const event = {
        button: 0,
        pointerId: 1,
        currentTarget: marker,
        clientX: 30,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }
      marker.props.onPointerdown(event)
      marker.props.onPointermove({ ...event, clientX: 31 })
      await nextTick()
      expect(state.byId('waveform-apply-markers').props.disabled).toBe(true)
      expect(state.byId('waveform-cancel-markers').props.disabled).toBe(true)
      state.byId('waveform-apply-markers').props.onClick()
      state.byId('waveform-cancel-markers').props.onClick()
      if (mode === 'escape') escape(state)
      else
        marker.props[mode === 'pointercancel' ? 'onPointercancel' : 'onLostpointercapture'](event)
      await nextTick()
      expect(marker.props['aria-valuenow']).toBe(1100)
      expect(marker.releasePointerCapture).toHaveBeenCalledWith(1)
      expect(state.byId('waveform-apply-markers').props.disabled).toBe(false)
      expect(state.updateMarkers).not.toHaveBeenCalled()
      escape(state)
      await nextTick()
      expect(marker.props['aria-valuenow']).toBe(1000)
    }
  )

  it.each(['selection', 'line', 'source', 'next-start', 'document', 'words', 'unmount'])(
    'discards obsolete staged markers after %s changes',
    async mode => {
      const state = await mount({
        selectedLine: { start_ms: 1000, end_ms: 3000, words: [] },
        selectedLineIndex: 0,
      })
      key(state, 'start', 'ArrowRight')
      await nextTick()
      const apply = state.byId('waveform-apply-markers').props.onClick
      if (mode === 'selection') state.props.selectedLineIndex = 1
      else if (mode === 'line') state.props.selectedLine = { start_ms: 1000, end_ms: 3000 }
      else if (mode === 'source') state.props.audioSource = { type: 'library', id: 2 }
      else if (mode === 'next-start') state.props.nextLineStartMs = 4000
      else if (mode === 'document') state.props.selectedLine.end_ms = 3200
      else if (mode === 'words') state.props.selectedLine.words.push({ start_ms: 1200 })
      else {
        state.app.unmount()
        apps.pop()
      }
      await nextTick()
      apply()
      expect(state.byId('waveform-apply-markers')).toBeUndefined()
      expect(state.updateMarkers).not.toHaveBeenCalled()
    }
  )

  it('retains an implicit end in the draft and rejects malformed word bounds', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000 },
      selectedLineIndex: 0,
      nextLineStartMs: 3000,
    })
    key(state, 'start', 'ArrowRight')
    await nextTick()
    state.byId('waveform-apply-markers').props.onClick()
    expect(state.updateMarkers).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ startMs: 1100, endMs: 3000 })
    )
    state.props.selectedLine.words = [{ start_ms: 500 }]
    await nextTick()
    expect(state.byId('waveform-marker-start')).toBeUndefined()
    expect(state.byId('waveform-apply-markers')).toBeUndefined()
  })

  it('lets editor/history shortcuts bubble, including configured global keys, without seeking or editing', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000, end_ms: 3000 },
      selectedLineIndex: 0,
    })
    const root = state.byId('editor-waveform')
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
      for (const [key, shiftKey] of [
        ['z', false],
        ['z', true],
        ['y', false],
        ['s', false],
        ['/', false],
        ['ArrowRight', false],
      ]) {
        const event = {
          key,
          shiftKey,
          ...modifiers,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        }
        state.byId('waveform-marker-start').props.onKeydown(event)
        state.byId('waveform-seek').props.onKeydown(event)
        root.props.onKeydown(event)
        expect(event.preventDefault).not.toHaveBeenCalled()
        expect(event.stopPropagation).not.toHaveBeenCalled()
      }
    }
    setShortcutOverride('saveLyrics', ['Shift', '→'])
    const configured = {
      key: 'ArrowRight',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    state.byId('waveform-marker-start').props.onKeydown(configured)
    state.byId('waveform-seek').props.onKeydown(configured)
    root.props.onKeydown(configured)
    expect(configured.preventDefault).not.toHaveBeenCalled()
    expect(configured.stopPropagation).not.toHaveBeenCalled()
    expect(state.seek).not.toHaveBeenCalled()
    expect(state.updateMarkers).not.toHaveBeenCalled()
    const tab = { key: 'Tab', stopPropagation: vi.fn() }
    root.props.onKeydown(tab)
    expect(tab.stopPropagation).not.toHaveBeenCalled()
    const arrow = { key: 'ArrowRight', preventDefault: vi.fn(), stopPropagation: vi.fn() }
    state.byId('waveform-marker-start').props.onKeydown(arrow)
    root.props.onKeydown(arrow)
    expect(state.updateMarkers).not.toHaveBeenCalled()
    await nextTick()
    expect(state.byId('waveform-apply-markers')).toBeDefined()
    expect(arrow.stopPropagation).toHaveBeenCalledOnce()
  })
  it('pages on playing progress, loops backward, and allows paused pan and disabled follow', async () => {
    const state = await mount({ playing: true })
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    state.draw()
    requestAnimationFrame.mockClear()
    state.props.progress = 40
    await nextTick()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    state.props.progress = 80
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(60)
    expect(state.byId('waveform-playhead')).toBeDefined()
    state.props.progress = 2
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(0)
    state.props.playing = false
    await nextTick()
    state.byId('waveform-pan').props.onInput({ target: { value: 60 } })
    state.props.progress = 3
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(60)
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(false)
    state.props.playing = true
    state.props.progress = 4
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(0)
  })

  it('stages drag and keyboard movement until Apply without seeking', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000, end_ms: 3000, words: [] },
      selectedLineIndex: 0,
      timingStepMs: 25,
    })
    const marker = state.byId('waveform-marker-start')
    marker.setPointerCapture = vi.fn()
    marker.hasPointerCapture = () => false
    const event = {
      button: 0,
      pointerId: 1,
      currentTarget: marker,
      clientX: 24,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    marker.props.onPointerdown(event)
    marker.props.onPointermove({ ...event, clientX: 26 })
    await nextTick()
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.props.selectedLine.start_ms).toBe(1000)
    marker.props.onPointerup({ ...event, clientX: 26 })
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.seek).not.toHaveBeenCalled()
    await nextTick()
    marker.props.onKeydown({ key: 'ArrowRight', preventDefault: vi.fn() })
    await nextTick()
    expect(marker.props['aria-valuetext']).toContain('01.625')
    state.byId('waveform-apply-markers').props.onClick()
    expect(state.updateMarkers).toHaveBeenCalledExactlyOnceWith({
      lineIndex: 0,
      line: state.props.selectedLine,
      startMs: 1625,
      endMs: 3000,
      durationMs: 120000,
    })
    await nextTick()
    expect(state.byId('waveform-apply-markers')).toBeUndefined()
    expect(marker.props['aria-valuenow']).toBe(1000)
  })

  it('does not commit an off-center click or cancel for another pointer', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000, end_ms: 3000 },
      selectedLineIndex: 0,
    })
    const marker = state.byId('waveform-marker-start')
    marker.setPointerCapture = vi.fn()
    marker.hasPointerCapture = () => false
    const event = {
      button: 0,
      pointerId: 1,
      currentTarget: marker,
      clientX: 29,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    marker.props.onPointerdown(event)
    marker.props.onPointerup(event)
    expect(state.updateMarkers).not.toHaveBeenCalled()
    marker.props.onPointerdown(event)
    marker.props.onPointercancel({ pointerId: 2 })
    marker.props.onPointermove({ ...event, clientX: 31 })
    marker.props.onPointerup({ ...event, clientX: 31 })
    await nextTick()
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(marker.props['aria-valuenow']).toBe(1600)
    state.byId('waveform-apply-markers').props.onClick()
    expect(state.updateMarkers).toHaveBeenCalledOnce()
    expect(state.updateMarkers).toHaveBeenLastCalledWith(expect.objectContaining({ startMs: 1600 }))
  })

  it.each(['pointercancel', 'lostpointercapture', 'escape', 'selection', 'source', 'unmount'])(
    'discards marker previews after %s',
    async mode => {
      const state = await mount({
        selectedLine: { start_ms: 1000, end_ms: 3000 },
        selectedLineIndex: 0,
      })
      const marker = state.byId('waveform-marker-start')
      marker.setPointerCapture = vi.fn()
      marker.hasPointerCapture = () => false
      const event = {
        button: 0,
        pointerId: 1,
        currentTarget: marker,
        clientX: 24,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }
      marker.props.onPointerdown(event)
      marker.props.onPointermove({ ...event, clientX: 26 })
      if (mode === 'escape')
        state.byId('editor-waveform').props.onKeydown({
          key: 'Escape',
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        })
      else if (mode === 'selection') state.props.selectedLineIndex = 1
      else if (mode === 'source') state.props.audioSource = { type: 'library', id: 2 }
      else if (mode === 'unmount') {
        state.app.unmount()
        apps.pop()
      } else
        marker.props[mode === 'pointercancel' ? 'onPointercancel' : 'onLostpointercapture'](event)
      await nextTick()
      marker.props.onPointerup({ ...event, clientX: 26 })
      expect(state.updateMarkers).not.toHaveBeenCalled()
    }
  )
  it.each([
    [59.94, '0:59.9'],
    [59.96, '1:00.0'],
    [119.96, '2:00.0'],
  ])(
    'rounds %s before splitting minutes for accessible values and the ruler',
    async (seconds, expected) => {
      invoke.mockResolvedValue({ ...data, duration: seconds })
      const state = await mount({ progress: seconds })
      expect(state.byId('waveform-seek').props['aria-valuetext']).toBe(expected)
      expect(state.text(state.byId('waveform-window'))).toBe(`0:00.0 - ${expected}`)
      state.draw()
      expect(state.context.fillText).toHaveBeenCalledWith(expected, 400, 106)
    }
  )

  it('exposes slider semantics and bounded Arrow/Home/End seeking without editor hotkeys', async () => {
    const state = await mount()
    const slider = state.byId('waveform-seek')
    expect(slider.props).toMatchObject({
      role: 'slider',
      tabindex: '0',
      'aria-label': 'Seek in waveform',
      'aria-valuemin': '0',
      'aria-valuemax': 120,
      'aria-valuenow': 30,
    })
    for (const [key, shiftKey, target] of [
      ['ArrowLeft', false, 29.9],
      ['ArrowRight', false, 30.1],
      ['ArrowRight', true, 35],
      ['Home', false, 0],
      ['End', false, 120],
    ]) {
      const event = { key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() }
      slider.props.onKeydown(event)
      state.byId('editor-waveform').props.onKeydown(event)
      expect(state.seek).toHaveBeenLastCalledWith(target)
      expect(event.preventDefault).toHaveBeenCalledOnce()
      expect(event.stopPropagation).toHaveBeenCalledOnce()
    }
    const unrelated = { key: 'Tab', preventDefault: vi.fn() }
    slider.props.onKeydown(unrelated)
    expect(unrelated.preventDefault).not.toHaveBeenCalled()
    state.props.progress = 0
    await nextTick()
    state.byId('waveform-seek').props.onKeydown({ key: 'ArrowLeft', preventDefault: vi.fn() })
    expect(state.seek).toHaveBeenLastCalledWith(0)
    state.props.progress = 120
    await nextTick()
    state.byId('waveform-seek').props.onKeydown({ key: 'ArrowRight', preventDefault: vi.fn() })
    expect(state.seek).toHaveBeenLastCalledWith(120)
  })

  it('keeps labeled zoom/fit/pan controls local and maps clicks within the zoomed view', async () => {
    const state = await mount()
    const zoomIn = state.byLabel('Zoom in waveform')
    expect(zoomIn.props.title).toBe('Zoom in waveform')
    expect(state.byLabel('Zoom out waveform').props.disabled).toBe(true)
    expect(state.byLabel('Fit entire waveform').props.disabled).toBe(true)
    zoomIn.props.onClick()
    await nextTick()
    const pan = state.byId('waveform-pan')
    expect(pan.props).toMatchObject({
      type: 'range',
      'aria-label': 'Pan waveform',
      min: '0',
      max: 60,
    })
    pan.props.onInput({ target: { value: '60' } })
    await nextTick()
    const slider = state.byId('waveform-seek')
    slider.props.onClick({ clientX: 220, currentTarget: slider })
    expect(state.seek).toHaveBeenLastCalledWith(90)
    slider.props.onClick({ clientX: 900, currentTarget: slider })
    expect(state.seek).toHaveBeenLastCalledWith(120)
    state.byLabel('Fit entire waveform').props.onClick()
    await nextTick()
    expect(state.byId('waveform-pan')).toBeUndefined()
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('repeatedly double-clicks into a point without moving selected markers or seeking', async () => {
    const state = await mount({
      progress: 100,
      playing: true,
      selectedLine: { start_ms: 20000, end_ms: 24000 },
      selectedLineIndex: 0,
    })
    for (const span of [60, 30, 15]) {
      const slider = state.byId('waveform-seek')
      slider.props.onDblclick({
        clientX: 220,
        currentTarget: slider,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      })
      await nextTick()
      expect(state.byId('waveform-pan').props.max).toBe(120 - span)
      expect(state.byId('waveform-pan').props.value).toBe(60 - span / 2)
    }
    const before = state.byId('waveform-pan').props.value
    state.props.progress = 110
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(before)
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(false)
    expect(state.props.selectedLine).toEqual({ start_ms: 20000, end_ms: 24000 })
    expect(state.seek).not.toHaveBeenCalled()
    expect(state.updateMarkers).not.toHaveBeenCalled()
  })

  it('zooms around the selected marker while paused without disabling follow', async () => {
    const state = await mount({
      progress: 100,
      playing: false,
      selectedLine: { start_ms: 20000, end_ms: 24000 },
      selectedLineIndex: 0,
    })
    for (let index = 0; index < 4; index++) {
      state.byLabel('Zoom in waveform').props.onClick()
      await nextTick()
      expect(state.byId('waveform-marker-start')).toBeDefined()
    }
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(true)
    const before = state.byId('waveform-pan').props.value
    state.props.progress = 101
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(before)
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.seek).not.toHaveBeenCalled()
  })

  it('holds manual panning during playback until following is explicitly re-enabled', async () => {
    const state = await mount({ playing: true })
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    state.byId('waveform-pan').props.onInput({ target: { value: '60' } })
    await nextTick()
    state.props.progress = 31
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(60)
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(false)
    state.byLabel('Follow waveform playback').props.onClick()
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(0)
  })

  it('keeps following the playhead after zooming with a selected phrase', async () => {
    const state = await mount({
      progress: 20,
      playing: true,
      selectedLine: { start_ms: 20000, end_ms: 24000 },
      selectedLineIndex: 0,
    })
    for (let index = 0; index < 4; index++) {
      state.byLabel('Zoom in waveform').props.onClick()
      await nextTick()
    }
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(true)
    for (const progress of [29, 45, 2, 119, 120]) {
      state.props.progress = progress
      await nextTick()
      expect(state.byId('waveform-playhead')).toBeDefined()
    }
    expect(state.updateMarkers).not.toHaveBeenCalled()
  })

  it('preserves draft marker timestamps through playback, panning and zoom', async () => {
    const state = await mount({
      progress: 20,
      playing: true,
      selectedLine: { start_ms: 20000, end_ms: 24000 },
      selectedLineIndex: 0,
    })
    state
      .byId('waveform-marker-start')
      .props.onKeydown({ key: 'ArrowRight', preventDefault: vi.fn() })
    await nextTick()
    expect(state.updateMarkers).not.toHaveBeenCalled()
    for (let index = 0; index < 4; index++) {
      state.byLabel('Zoom in waveform').props.onClick()
      await nextTick()
    }
    state.props.progress = 90
    await nextTick()
    expect(state.byId('waveform-playhead')).toBeDefined()
    state.byId('waveform-pan').props.onInput({ target: { value: 18 } })
    await nextTick()
    expect(state.byId('waveform-marker-start').props['aria-valuenow']).toBe(20100)
    expect(state.byId('waveform-marker-end').props['aria-valuenow']).toBe(24000)
    state.props.progress = 91
    await nextTick()
    expect(state.props.selectedLine).toEqual({ start_ms: 20000, end_ms: 24000 })
    expect(state.text(state.byId('waveform-marker-preview'))).toContain('20.100')
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.seek).not.toHaveBeenCalled()
  })

  it('preserves an explicitly disabled follow choice across zoom and playback restarts', async () => {
    const state = await mount({
      selectedLine: { start_ms: 20000, end_ms: 24000 },
      selectedLineIndex: 0,
    })
    state.byLabel('Follow waveform playback').props.onClick()
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    state.byId('waveform-pan').props.onInput({ target: { value: 60 } })
    await nextTick()
    state.props.playing = true
    state.props.progress = 3
    await nextTick()
    expect(state.byLabel('Follow waveform playback').props['aria-pressed']).toBe(false)
    expect(state.byId('waveform-pan').props.value).toBe(60)
  })

  it('keeps the visible end marker reachable when magnifying after manual scrolling', async () => {
    const state = await mount({
      progress: 0,
      selectedLine: { start_ms: 20000, end_ms: 90000 },
      selectedLineIndex: 0,
    })
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    state.byId('waveform-pan').props.onInput({ target: { value: '60' } })
    await nextTick()
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(75)
    expect(state.byId('waveform-marker-end')).toBeDefined()
    expect(state.byId('waveform-marker-start')).toBeUndefined()
  })

  it('ignores zoom, fit, pan and wheel during marker dragging', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000, end_ms: 3000 },
      selectedLineIndex: 0,
    })
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    const before = state.byId('waveform-pan').props.value
    const marker = state.byId('waveform-marker-start')
    marker.setPointerCapture = vi.fn()
    marker.hasPointerCapture = () => false
    const event = {
      button: 0,
      pointerId: 1,
      clientX: 30,
      currentTarget: marker,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    marker.props.onPointerdown(event)
    await nextTick()
    const slider = state.byId('waveform-seek')
    slider.props.onDblclick({
      clientX: 220,
      currentTarget: slider,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    })
    state.byLabel('Zoom in waveform').props.onClick()
    state.byLabel('Fit entire waveform').props.onClick()
    state.byId('waveform-pan').props.onInput({ target: { value: 60 } })
    state
      .all()
      .find(element => element.props.onWheel)
      .props.onWheel({ deltaY: 100 })
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(before)
    expect(state.byId('waveform-pan').props.max).toBe(60)
    marker.props.onPointercancel(event)
    expect(state.updateMarkers).not.toHaveBeenCalled()
  })

  it('uses the magnified time scale for fine marker movement without a grab jump', async () => {
    const state = await mount({
      selectedLine: { start_ms: 1000, end_ms: 3000 },
      selectedLineIndex: 0,
    })
    for (let index = 0; index < 4; index++) {
      state.byLabel('Zoom in waveform').props.onClick()
      await nextTick()
    }
    expect(state.updateMarkers).not.toHaveBeenCalled()
    const marker = state.byId('waveform-marker-start')
    marker.setPointerCapture = vi.fn()
    marker.hasPointerCapture = () => false
    const event = {
      button: 0,
      pointerId: 1,
      clientX: 30,
      currentTarget: marker,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    marker.props.onPointerdown(event)
    marker.props.onPointerup({ ...event, clientX: 31 })
    await nextTick()
    expect(marker.props['aria-valuenow']).toBe(1019)
    expect(state.updateMarkers).not.toHaveBeenCalled()
    state.byId('waveform-apply-markers').props.onClick()
    expect(state.updateMarkers).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        startMs: 1019,
      })
    )
    expect(state.props.selectedLine).toEqual({ start_ms: 1000, end_ms: 3000 })
  })

  it('scrolls the zoomed waveform with wheel/trackpad input without changing markers', async () => {
    const state = await mount({
      progress: 0,
      selectedLine: { start_ms: 90000, end_ms: 100000 },
      selectedLineIndex: 0,
    })
    state.byLabel('Zoom in waveform').props.onClick()
    await nextTick()
    const plot = state.all().find(element => element.props.onWheel)
    const event = { deltaX: -400, deltaY: 0, deltaMode: 0, preventDefault: vi.fn() }
    plot.props.onWheel(event)
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(0)
    expect(state.byId('waveform-marker-start')).toBeUndefined()
    plot.props.onWheel({ ...event, deltaX: 0, deltaY: 1, deltaMode: 2 })
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(60)
    expect(state.byId('waveform-marker-start')).toBeDefined()
    expect(state.byId('waveform-marker-end')).toBeDefined()
    expect(state.updateMarkers).not.toHaveBeenCalled()
    expect(state.seek).not.toHaveBeenCalled()
    const ignored = { ...event, ctrlKey: true, preventDefault: vi.fn() }
    plot.props.onWheel(ignored)
    expect(ignored.preventDefault).not.toHaveBeenCalled()
  })

  it('announces loading/error, disables unavailable controls, and recovers with Retry', async () => {
    let reject
    invoke.mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          reject = fail
        })
    )
    const state = await mount()
    expect(state.text()).toContain('Loading waveform...')
    expect(state.all().find(element => element.props.role === 'status').props['aria-busy']).toBe(
      true
    )
    expect(state.byId('waveform-seek')).toBeUndefined()
    for (const label of ['Zoom in waveform', 'Zoom out waveform', 'Fit entire waveform'])
      expect(state.byLabel(label).props.disabled).toBe(true)
    reject(new Error('Decoder unavailable'))
    await nextTick()
    await nextTick()
    expect(state.text(state.byId('waveform-error'))).toContain('Decoder unavailable')
    expect(state.all().find(element => element.props.role === 'status').props['aria-busy']).toBe(
      false
    )
    const retry = state
      .all()
      .find(element => element.type === 'button' && state.text(element).trim() === 'Retry')
    retry.props.onClick()
    await nextTick()
    await nextTick()
    expect(state.byId('waveform-error')).toBeUndefined()
    expect(state.byId('waveform-seek')).toBeDefined()
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('renders no-audio state without requests or a seek target', async () => {
    const state = await mount({ audioSource: { type: 'file' }, progress: null })
    expect(state.text()).toContain('No audio available')
    expect(state.byId('waveform-seek')).toBeUndefined()
    expect(state.byId('waveform-apply-markers')).toBeUndefined()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('moves only the playhead on playback updates and disposes canvas resources', async () => {
    const state = await mount()
    state.draw()
    expect(state.all().find(element => element.type === 'canvas').width).toBe(800)
    expect(state.byId('waveform-playhead').props.style.left).toBe('25%')
    requestAnimationFrame.mockClear()
    state.props.progress = 60
    await nextTick()
    expect(state.byId('waveform-playhead').props.style.left).toBe('50%')
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    observers[1].callback()
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    state.app.unmount()
    apps.pop()
    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(frames.size).toBe(0)
    observers.forEach(observer => expect(observer.disconnect).toHaveBeenCalledOnce())
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})

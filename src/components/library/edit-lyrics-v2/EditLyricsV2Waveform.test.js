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
  const updateMarker = vi.fn()
  const app = renderer.createApp({
    render: () => h(component, { ...props, onSeek: seek, onUpdateMarker: updateMarker }),
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
  return { app, props, seek, updateMarker, all, byId, byLabel, text, draw, context }
}

describe('waveform controls and states', () => {
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
    expect(state.updateMarker).not.toHaveBeenCalled()
    const tab = { key: 'Tab', stopPropagation: vi.fn() }
    root.props.onKeydown(tab)
    expect(tab.stopPropagation).not.toHaveBeenCalled()
    const arrow = { key: 'ArrowRight', preventDefault: vi.fn(), stopPropagation: vi.fn() }
    state.byId('waveform-marker-start').props.onKeydown(arrow)
    root.props.onKeydown(arrow)
    expect(state.updateMarker).toHaveBeenCalledOnce()
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
    state.byLabel('Follow waveform playback').props.onClick()
    state.props.playing = true
    state.props.progress = 4
    await nextTick()
    expect(state.byId('waveform-pan').props.value).toBe(60)
  })

  it('previews marker movement locally and emits one completed drag without seeking', async () => {
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
    expect(state.updateMarker).not.toHaveBeenCalled()
    expect(state.props.selectedLine.start_ms).toBe(1000)
    marker.props.onPointerup({ ...event, clientX: 26 })
    expect(state.updateMarker).toHaveBeenCalledOnce()
    expect(state.updateMarker.mock.calls[0][0]).toMatchObject({ boundary: 'start', timeMs: 1600 })
    expect(state.seek).not.toHaveBeenCalled()
    await nextTick()
    marker.props.onKeydown({ key: 'ArrowRight', preventDefault: vi.fn() })
    expect(state.updateMarker).toHaveBeenLastCalledWith(expect.objectContaining({ timeMs: 1025 }))
    expect(marker.props['aria-valuetext']).toContain('01.000')
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
    expect(state.updateMarker).not.toHaveBeenCalled()
    marker.props.onPointerdown(event)
    marker.props.onPointercancel({ pointerId: 2 })
    marker.props.onPointermove({ ...event, clientX: 31 })
    marker.props.onPointerup({ ...event, clientX: 31 })
    expect(state.updateMarker).toHaveBeenCalledOnce()
    expect(state.updateMarker).toHaveBeenLastCalledWith(expect.objectContaining({ timeMs: 1600 }))
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
      if (mode === 'escape') marker.props.onKeydown({ key: 'Escape', preventDefault: vi.fn() })
      else if (mode === 'selection') state.props.selectedLineIndex = 1
      else if (mode === 'source') state.props.audioSource = { type: 'library', id: 2 }
      else if (mode === 'unmount') {
        state.app.unmount()
        apps.pop()
      } else
        marker.props[mode === 'pointercancel' ? 'onPointercancel' : 'onLostpointercapture'](event)
      await nextTick()
      marker.props.onPointerup({ ...event, clientX: 26 })
      expect(state.updateMarker).not.toHaveBeenCalled()
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

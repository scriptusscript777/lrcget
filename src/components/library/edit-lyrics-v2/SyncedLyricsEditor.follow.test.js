import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SyncedLyricsEditor from './SyncedLyricsEditor.vue'
import { useLyricsFollow } from '@/composables/edit-lyrics-v2/useLyricsFollow.js'

vi.mock('@/composables/edit-lyrics-v2/useLyricsFollow.js', () => ({ useLyricsFollow: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

async function setupEditor() {
  const props = reactive({
    modelValue: [{ text: 'First line', start_ms: 1000, end_ms: 2000 }],
    selectedLineIndex: 0,
    selectedLineIndices: [],
    waveformProgress: 1.5,
    waveformPlaying: true,
    loopEnabled: false,
    markerEditing: false,
  })
  const emit = vi.fn()
  let state
  await renderToString(createSSRApp({
    setup() {
      state = SyncedLyricsEditor.setup(props, { expose: vi.fn(), emit })
      return () => null
    },
  }))
  return { props, emit, state, follow: useLyricsFollow.mock.calls[0][0] }
}

describe('synced editor lyric follow integration', () => {
  it('uses playback milliseconds and keeps automatic selection separate from manual pinning', async () => {
    const { props, emit, state, follow } = await setupEditor()
    expect(follow.enabled.value).toBe(true)
    expect(follow.timeMs.value).toBe(1500)
    expect(follow.playing.value).toBe(true)
    follow.onSelect(1)
    expect(emit).toHaveBeenCalledWith('update:selected-line-index', 1)
    expect(follow.enabled.value).toBe(true)
    state.selectLine(0)
    expect(follow.enabled.value).toBe(false)
    expect(emit).toHaveBeenCalledWith('update:selected-line-index', 0)
    props.waveformProgress = null
    expect(follow.timeMs.value).toBe(-1)
    expect(emit).not.toHaveBeenCalledWith('play-line', expect.anything())
    expect(emit).not.toHaveBeenCalledWith('update:words', expect.anything())
  })

  it('blocks collapsed, loop, marker, inline, multi-selection and word-drag states', async () => {
    const { props, state, follow } = await setupEditor()
    expect(follow.blocked.value).toBe(true)
    state.wordTimingExpanded.value = true
    expect(follow.blocked.value).toBe(false)
    for (const flag of ['loopEnabled', 'markerEditing']) {
      props[flag] = true
      expect(follow.blocked.value).toBe(true)
      props[flag] = false
      expect(follow.blocked.value).toBe(false)
    }
    for (const flag of ['isDragging', 'wordEditing']) {
      state[flag].value = true
      expect(follow.blocked.value).toBe(true)
      state[flag].value = false
      expect(follow.blocked.value).toBe(false)
    }
    state.editingLineIndex.value = 0
    expect(follow.blocked.value).toBe(true)
    state.editingLineIndex.value = null
    props.selectedLineIndices = [0, 1]
    expect(follow.blocked.value).toBe(true)
    props.selectedLineIndices = []
    expect(follow.blocked.value).toBe(false)
  })

  it('pins even the same line when inline editing or starting multi-selection', async () => {
    const { state, follow } = await setupEditor()
    state.startEditingLine(0)
    expect(follow.enabled.value).toBe(false)
    expect(follow.blocked.value).toBe(true)
    state.cancelEditingLine()
    await nextTick()
    follow.enabled.value = true
    state.startDragSelection(0, { ctrlKey: true })
    expect(follow.enabled.value).toBe(false)
  })
})

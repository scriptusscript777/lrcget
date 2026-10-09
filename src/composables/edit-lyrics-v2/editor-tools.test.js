import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, effectScope, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SyncedLyricsEditor from '@/components/library/edit-lyrics-v2/SyncedLyricsEditor.vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditLyricsV2Document } from './useEditLyricsV2Document.js'
import { useEditLyricsV2Playback } from './useEditLyricsV2Playback.js'
import { useEditLyricsV2Export } from './useEditLyricsV2Export.js'
import { useLyricHistory } from './useLyricHistory.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/components/library/edit-lyrics-v2/SyncedWordTimingLane.vue', () => ({
  default: { render: () => null },
}))
beforeEach(() => vi.resetAllMocks())

const line = () => ({
  text: 'test phrase',
  start_ms: 1000,
  end_ms: 2000,
  words: [{ text: 'test', start_ms: 1000, end_ms: 1400 }],
})
const document = () => {
  const scope = effectScope()
  const state = scope.run(() =>
    useEditLyricsV2Document({
      audioSource: ref({ type: 'library', id: 1, duration: 10 }),
      lyricsfile: ref({ content: '' }),
      trackId: ref(1),
      progress: ref(1.5),
      toast: { error: vi.fn() },
    })
  )
  state.initializeLyrics()
  return { state, scope }
}

describe('synced editing history and timing steps', () => {
  it('renders available undo and redo buttons enabled outside inline editing', async () => {
    const html = await renderToString(
      createSSRApp(SyncedLyricsEditor, { modelValue: [], canUndo: true, canRedo: true })
    )
    for (const action of ['Undo', 'Redo']) {
      const button = html.match(new RegExp(`<button[^>]*title="${action} synced edit[^>]*>`))[0]
      expect(button).not.toMatch(/\sdisabled(?:[ =>])/)
    }
  })
  it('undoes deletion and word edits, restores saved dirty state, and branches redo', async () => {
    const { state, scope } = document()
    state.updateSyncedLines([line()])
    invoke.mockResolvedValue(undefined)
    await state.saveLyrics()
    state.updateLineText(0, 'changed')
    expect(state.syncedLines.value[0].words).toEqual([])
    state.undo()
    expect(state.syncedLines.value[0]).toEqual(line())
    expect(state.isDirty.value).toBe(false)
    state.redo()
    expect(state.syncedLines.value[0].text).toBe('changed')
    state.deleteSyncedLine(0)
    state.undo()
    expect(state.syncedLines.value).toHaveLength(1)
    state.updateLineText(0, 'new branch')
    expect(state.canRedo.value).toBe(false)
    scope.stop()
  })

  it.each([10, 25, 50, 100])('moves line and word boundaries together by %d ms', step => {
    const { state, scope } = document()
    state.updateSyncedLines([line()])
    state.timingStepMs.value = step
    state.forwardLineBy100(0)
    expect(state.syncedLines.value[0].start_ms).toBe(1000 + step)
    expect(state.syncedLines.value[0].end_ms).toBe(2000 + step)
    expect(state.syncedLines.value[0].words[0].end_ms).toBe(1400 + step)
    state.rewindLineBy100(0)
    expect(state.syncedLines.value[0]).toEqual(line())
    scope.stop()
  })

  it('clamps at zero using the actual displacement and handles bulk edits', () => {
    const { state, scope } = document()
    state.updateSyncedLines([{ ...line(), start_ms: 20 }])
    state.bulkRewindLines([0])
    expect(state.syncedLines.value[0].start_ms).toBe(0)
    expect(state.syncedLines.value[0].end_ms).toBe(1980)
    state.undo()
    expect(state.syncedLines.value[0].start_ms).toBe(20)
    scope.stop()
  })

  it('does not overwrite edits made during an asynchronous save', async () => {
    const { state, scope } = document()
    state.updateSyncedLines([line()])
    let finish
    invoke.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const saving = state.saveLyrics()
    state.updateLineText(0, 'typed while saving')
    finish()
    expect(await saving).toBe(true)
    expect(state.syncedLines.value[0].text).toBe('typed while saving')
    expect(state.isDirty.value).toBe(true)
    scope.stop()
  })

  it('bounds history and never includes prior-track edits after reset', () => {
    const scope = effectScope()
    const value = ref({ number: 0 })
    const history = scope.run(() =>
      useLyricHistory(
        () => value.value,
        state => {
          value.value = state
        },
        2
      )
    )
    history.reset()
    for (let number = 1; number <= 3; number++) value.value = { number }
    history.undo()
    history.undo()
    history.undo()
    expect(value.value.number).toBe(1)
    history.reset()
    expect(history.canUndo.value).toBe(false)
    scope.stop()
  })
})

const player = () => {
  const scope = effectScope()
  const controls = {
    audioSource: ref({ type: 'library', id: 1 }),
    syncedLines: ref([line(), { ...line(), start_ms: 4000, end_ms: 5000 }]),
    progress: ref(0),
    duration: ref(10),
    selectedLineIndex: ref(0),
    playingTrack: ref({ id: 1 }),
    status: ref('paused'),
    playTrack: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
  }
  return { scope, controls, state: scope.run(() => useEditLyricsV2Playback(controls)) }
}

describe('phrase loop', () => {
  it('plays with context and seeks only once until the player acknowledges the seek', async () => {
    const { state, controls, scope } = player()
    await state.toggleLoop()
    expect(controls.seek).toHaveBeenLastCalledWith(0)
    controls.status.value = 'playing'
    controls.progress.value = 2.6
    await nextTick()
    expect(controls.seek).toHaveBeenCalledTimes(2)
    controls.progress.value = 2.7
    await nextTick()
    expect(controls.seek).toHaveBeenCalledTimes(2)
    controls.progress.value = 0.2
    await nextTick()
    controls.progress.value = 2.6
    await nextTick()
    expect(controls.seek).toHaveBeenCalledTimes(3)
    controls.selectedLineIndex.value = 1
    await nextTick()
    expect(state.loopEnabled.value).toBe(false)
    scope.stop()
  })

  it('rejects missing/reversed boundaries and does not loop another track', async () => {
    const { state, controls, scope } = player()
    controls.syncedLines.value = [{ text: 'untimed' }]
    expect(state.canLoop.value).toBe(false)
    await state.toggleLoop()
    expect(controls.seek).not.toHaveBeenCalled()
    controls.syncedLines.value = [line()]
    await state.toggleLoop()
    controls.playingTrack.value = { id: 2 }
    controls.status.value = 'playing'
    await nextTick()
    expect(state.loopEnabled.value).toBe(false)
    scope.stop()
  })
})

describe('editor exports', () => {
  it('captures submitted content and blocks duplicate exports during the save', async () => {
    let finish
    const content = ref('submitted document')
    const save = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
    const state = useEditLyricsV2Export({ audioSource: ref({ type: 'library', id: 1 }), saveLyrics: save, serializedLyricsfile: content, toast })
    invoke.mockResolvedValue([{ format: 'lrc', status: { type: 'success' } }])
    const exporting = state.exportLyrics({ syncedLrc: true })
    expect(await state.exportLyrics({ syncedLrc: true })).toBe(false)
    content.value = 'new unsaved edits'
    finish(true)
    expect(await exporting).toBe(true)
    expect(invoke).toHaveBeenCalledWith('export_lyrics', { trackId: 1, formats: ['lrc'], lyricsfile: 'submitted document' })
    expect(save).toHaveBeenCalledOnce()
    expect(state.isExporting.value).toBe(false)
  })

  it('reports which target failed and does not call a partial export complete', async () => {
    const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
    const state = useEditLyricsV2Export({ audioSource: ref({ type: 'library', id: 1 }), saveLyrics: vi.fn().mockResolvedValue(true), serializedLyricsfile: ref('document'), toast })
    invoke.mockResolvedValue([{ format: 'lrc', status: { type: 'success' } }, { format: 'embedded', status: { type: 'error', message: 'disk full' } }])
    expect(await state.exportLyrics({ syncedLrc: true, embedIntoTrack: true })).toBe(false)
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('embedded: disk full'))
    expect(state.isExporting.value).toBe(false)
  })
})

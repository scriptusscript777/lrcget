import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, effectScope, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SyncedLyricsEditor from '@/components/library/edit-lyrics-v2/SyncedLyricsEditor.vue'
import SyncedWordTimingSegment from '@/components/library/edit-lyrics-v2/SyncedWordTimingSegment.vue'
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
const document = (
  playbackProgress = ref(1.5),
  playbackDuration,
  audioSource = ref({ type: 'library', id: 1, duration: 10 })
) => {
  const scope = effectScope()
  const state = scope.run(() =>
    useEditLyricsV2Document({
      audioSource,
      lyricsfile: ref({ content: '' }),
      trackId: ref(1),
      progress: playbackProgress,
      playbackDuration,
      toast: { error: vi.fn() },
    })
  )
  state.initializeLyrics()
  return { state, scope }
}

describe('synced editing history and timing steps', () => {
  it('uses loaded recording duration when file metadata has no duration', () => {
    const { state, scope } = document(
      ref(1.5),
      ref(10),
      ref({ type: 'file', file_path: '/tmp/test.mp3' })
    )
    state.updateSyncedLines([{ text: 'sentence', start_ms: 1000, end_ms: 3000 }])
    expect(state.syncLineToCurrentProgress(0)).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1500, end_ms: 3000 })
    scope.stop()
  })
  it('updates first-word and sentence start together while keeping the end fixed and rejects invalid word edits', () => {
    const { state, scope } = document()
    state.updateSyncedLines([
      {
        text: 'first second',
        start_ms: 1000,
        end_ms: 3000,
        words: [
          { text: 'first ', start_ms: 1000 },
          { text: 'second', start_ms: 2000 },
        ],
      },
    ])
    expect(
      state.updateLineWords({
        lineIndex: 0,
        lineStartMs: 1200,
        words: [
          { text: 'first ', start_ms: 1200 },
          { text: 'second', start_ms: 2200 },
        ],
      })
    ).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1200, end_ms: 3000 })
    const before = JSON.parse(JSON.stringify(state.syncedLines.value))
    expect(
      state.updateLineWords({ lineIndex: 0, words: [{ text: 'missing', start_ms: 2200 }] })
    ).toBe(false)
    expect(
      state.updateLineWords({
        lineIndex: 0,
        words: [
          { text: 'first ', start_ms: 1200 },
          { text: 'second', start_ms: 3500 },
        ],
      })
    ).toBe(false)
    expect(state.syncedLines.value).toEqual(before)
    state.undo()
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1000, end_ms: 3000 })
    scope.stop()
  })

  it('syncs sentence boundaries from playback with one undoable update and fixed opposite marker', () => {
    const progress = ref(1.2)
    const { state, scope } = document(progress)
    state.updateSyncedLines([line(), { ...line(), start_ms: 3000, end_ms: 4000, words: [] }])
    const original = JSON.parse(JSON.stringify(state.syncedLines.value))
    expect(state.syncLineToCurrentProgress(0)).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({
      start_ms: 1200,
      end_ms: 2000,
      words: [{ text: 'test', start_ms: 1200, end_ms: 1600 }],
    })
    expect(state.syncedLines.value[1]).toEqual(original[1])
    state.undo()
    expect(state.syncedLines.value).toEqual(original)
    state.redo()
    progress.value = 2.5
    expect(state.syncEndToCurrentProgress(0)).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1200, end_ms: 2500 })
    state.undo()
    expect(state.syncedLines.value[0].end_ms).toBe(2000)
    state.forwardLineBy100(0)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1300, end_ms: 2100 })
    state.forwardEndBy100(0)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1300, end_ms: 2200 })
    scope.stop()
  })

  it('rejects unavailable playback, reversed boundaries, truncated words and out-of-recording changes', () => {
    const progress = ref(null)
    const { state, scope } = document(progress)
    state.updateSyncedLines([line()])
    const original = JSON.parse(JSON.stringify(state.syncedLines.value))
    for (const value of [null, NaN, -1, Infinity, 20]) {
      progress.value = value
      expect(state.syncLineToCurrentProgress(0)).toBe(false)
      expect(state.syncEndToCurrentProgress(0)).toBe(false)
      expect(state.syncedLines.value).toEqual(original)
    }
    progress.value = 2.1
    expect(state.syncLineToCurrentProgress(0)).toBe(false)
    progress.value = 1.2
    expect(state.syncEndToCurrentProgress(0)).toBe(false)
    state.timingStepMs.value = 100
    for (let i = 0; i < 10; i++) state.rewindEndBy100(0)
    expect(state.syncedLines.value[0].end_ms).toBe(1400)
    scope.stop()
  })

  it('assigns untimed sentence boundaries without fabricating word timestamps', () => {
    const progress = ref(1.5)
    const { state, scope } = document(progress)
    state.updateSyncedLines([{ text: 'untimed words', start_ms: null, end_ms: null }])
    expect(state.syncLineToCurrentProgress(0)).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({ start_ms: 1500, end_ms: null })
    progress.value = 2.5
    expect(state.syncEndToCurrentProgress(0)).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({
      text: 'untimed words',
      start_ms: 1500,
      end_ms: 2500,
    })
    expect(state.syncedLines.value[0].words).toBeUndefined()
    scope.stop()
  })

  it('initially selects the first timed lyric instead of an intro blank or untimed row', () => {
    const { state, scope } = document()
    const lines = [
      { text: '', start_ms: 0, end_ms: 500 },
      { text: 'not yet timed', start_ms: null, end_ms: null },
      { text: 'first sung sentence', start_ms: 1000, end_ms: 2000 },
      { text: 'second sentence', start_ms: 3000, end_ms: 4000 },
    ]
    state.updateSyncedLines(lines)
    expect(state.selectedSyncedLineIndex.value).toBe(2)
    expect(state.syncedLines.value).toEqual(lines)
    state.selectSyncedLine(3)
    state.ensureSelectedSyncedLine()
    expect(state.selectedSyncedLineIndex.value).toBe(3)
    state.selectSyncedLine(1)
    state.ensureSelectedSyncedLine()
    expect(state.selectedSyncedLineIndex.value).toBe(1)
    scope.stop()
  })

  it('allows zero-time lyrics and never fabricates boundaries for untimed or empty documents', () => {
    const { state, scope } = document()
    state.updateSyncedLines([{ text: 'opening', start_ms: 0, end_ms: 500 }])
    expect(state.selectedSyncedLineIndex.value).toBe(0)
    state.selectedSyncedLineIndex.value = -1
    state.updateSyncedLines([{ text: 'untimed', start_ms: null, end_ms: null }])
    expect(state.syncedLines.value[0]).toEqual({ text: 'untimed', start_ms: null, end_ms: null })
    state.updateSyncedLines([])
    expect(state.selectedSyncedLineIndex.value).toBe(-1)
    scope.stop()
  })

  it('corrects word text atomically without shifting timestamps, punctuation spacing or neighboring lines', () => {
    const { state, scope } = document()
    state.updateSyncedLines([
      {
        ...line(),
        words: [
          { text: 'test  ', start_ms: 1000, end_ms: 1400 },
          { text: 'phrase', start_ms: 1400, end_ms: 2000 },
        ],
        text: 'test  phrase',
      },
      { ...line(), start_ms: 3000, end_ms: 4000 },
    ])
    const original = state.syncedLines.value[0]
    const neighbor = state.syncedLines.value[1]
    expect(
      state.updateWordText({
        lineIndex: 0,
        line: original,
        wordIndex: 0,
        text: 'best',
        words: original.words,
      })
    ).toBe(true)
    expect(state.syncedLines.value[0]).toMatchObject({
      text: 'best  phrase',
      start_ms: 1000,
      end_ms: 2000,
      words: [
        { text: 'best  ', start_ms: 1000, end_ms: 1400 },
        { text: 'phrase', start_ms: 1400, end_ms: 2000 },
      ],
    })
    expect(state.syncedLines.value[1]).toBe(neighbor)
    state.undo()
    expect(state.syncedLines.value[0]).toEqual(original)
    state.redo()
    expect(state.syncedLines.value[0].text).toBe('best  phrase')
    scope.stop()
  })

  it('rejects stale, blank, multiword and mistimed word edits without changing the document', () => {
    const { state, scope } = document()
    state.updateSyncedLines([
      {
        ...line(),
        words: [
          { text: 'test ', start_ms: 1000 },
          { text: 'phrase', start_ms: 1400 },
        ],
      },
    ])
    const original = state.syncedLines.value[0]
    const payload = {
      lineIndex: 0,
      line: original,
      wordIndex: 0,
      words: original.words,
      text: 'best',
    }
    const before = state.syncedLines.value
    for (const change of [
      { line: {} },
      { text: '' },
      { text: 'two words' },
      { wordIndex: 9 },
      {
        words: [
          { text: 'test ', start_ms: 1500 },
          { text: 'phrase', start_ms: 1400 },
        ],
      },
    ])
      expect(state.updateWordText({ ...payload, ...change })).toBe(false)
    expect(state.syncedLines.value).toBe(before)
    scope.stop()
  })

  it('allows editing generated word boxes and does not overwrite separate plain lyrics', () => {
    const { state, scope } = document()
    state.updatePlainLyrics('reference text')
    state.updateSyncedLines([{ ...line(), words: [] }])
    const original = state.syncedLines.value[0]
    expect(
      state.updateWordText({
        lineIndex: 0,
        line: original,
        wordIndex: 1,
        text: 'word',
        words: [
          { text: 'test ', start_ms: 1000, end_ms: 1400 },
          { text: 'phrase', start_ms: 1400, end_ms: 2000 },
        ],
      })
    ).toBe(true)
    expect(state.syncedLines.value[0].text).toBe('test word')
    expect(state.plainLyrics.value).toBe('reference text')
    scope.stop()
  })
  it('retains native word timing tooltips and active highlighting without a hint bubble', async () => {
    const html = await renderToString(
      createSSRApp(SyncedWordTimingSegment, {
        word: { text: 'phrase' },
        wordIndex: 1,
        startMs: 1000,
        endMs: 2000,
        lineStartMs: 1000,
        lineEndMs: 2000,
        timelineWidth: 20,
        progressMs: 1500,
      })
    )
    expect(html).toContain(
      'title="phrase (00:01.000 - 00:02.000) - F2 or right-click to edit word"'
    )
    expect(html).toContain('font-bold')
    expect(html).toContain('bg-hoa-1500 dark:bg-hoa-1500')
    expect(html).not.toContain('bg-neutral-200')
    expect(html).not.toContain('Next word:')
    expect(html).not.toContain('top-full')
  })
  it('commits marker edits once, holds the end, shifts words, and never changes neighbors', () => {
    const { state, scope } = document()
    const original = { ...line(), words: [{ text: 'test', start_ms: 1000, end_ms: 2000 }] }
    state.updateSyncedLines([original, { ...line(), start_ms: 1500 }])
    const commit = (startMs, endMs, selected = state.syncedLines.value[0]) =>
      state.updateWaveformMarkers({
        lineIndex: 0,
        line: selected,
        startMs,
        endMs,
        durationMs: 10000,
      })
    commit(1000, 2000)
    expect(state.syncedLines.value[0]).toEqual(original)
    commit(1000, 2000)
    expect(state.syncedLines.value[0]).toEqual(original)
    commit(500, 2000)
    expect(state.syncedLines.value[0]).toMatchObject({
      start_ms: 500,
      end_ms: 2000,
      words: [{ text: 'test', start_ms: 500, end_ms: 1500 }],
    })
    expect(state.syncedLines.value[1].start_ms).toBe(1500)
    state.undo()
    expect(state.syncedLines.value[0]).toEqual(original)
    state.redo()
    commit(500, 1500)
    expect(state.syncedLines.value[0].end_ms).toBe(1500)
    const before = state.syncedLines.value
    commit(NaN, 1500)
    commit(600, 1500, original)
    commit(600, 1400)
    expect(state.syncedLines.value).toBe(before)
    scope.stop()
  })
  it('applies both confirmed markers atomically with one undo and preserves word offsets', () => {
    const { state, scope } = document()
    state.updateSyncedLines([line(), { ...line(), start_ms: 3000, end_ms: 5000, words: [] }])
    const original = state.syncedLines.value[0]
    const neighbor = state.syncedLines.value[1]
    state.updateWaveformMarkers({
      lineIndex: 0,
      line: original,
      startMs: 1800,
      endMs: 2800,
      durationMs: 10000,
    })
    expect(state.syncedLines.value[0]).toMatchObject({
      start_ms: 1800,
      end_ms: 2800,
      words: [{ start_ms: 1800, end_ms: 2200 }],
    })
    expect(state.syncedLines.value[1]).toBe(neighbor)
    state.undo()
    expect(state.syncedLines.value[0]).toEqual(original)
    state.redo()
    expect(state.syncedLines.value[0].start_ms).toBe(1800)
    scope.stop()
  })
  it('uses themed shared controls for timing steps and loop context', async () => {
    const html = await renderToString(
      createSSRApp(SyncedLyricsEditor, { modelValue: [], timingStepMs: 25 })
    )
    const select = html.match(/<select[^>]*aria-label="Timing step"[^>]*>/)[0]
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('id="word-timing-panel"')
    expect(select).toContain('select select-xs')
    expect(select).toContain('dark:[color-scheme:dark]')
    const inputs = html.match(/<input[^>]*type="number"[^>]*>/g)
    expect(inputs).toHaveLength(2)
    for (const input of inputs) {
      expect(input).toContain('class="input ')
      expect(input).toContain('dark:[color-scheme:dark]')
    }
  })
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
    markerPreview: ref(null),
    onError: vi.fn(),
    playingTrack: ref({ id: 1 }),
    status: ref('paused'),
    playTrack: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
  }
  return { scope, controls, state: scope.run(() => useEditLyricsV2Playback(controls)) }
}

describe('phrase loop', () => {
  it('explicit sentence Play stops a marker loop and continues beyond its end', async () => {
    const { state, controls, scope } = player()
    await state.toggleLoop()
    expect(state.loopEnabled.value).toBe(true)
    controls.seek.mockClear()
    await state.playLine(1)
    expect(state.loopEnabled.value).toBe(false)
    expect(controls.seek).toHaveBeenCalledExactlyOnceWith(4)
    controls.status.value = 'playing'
    controls.progress.value = 6
    await nextTick()
    expect(controls.seek).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('edit auditions retain looping, but explicit offset playback stops it', async () => {
    const { state, controls, scope } = player()
    await state.toggleLoop()
    await state.playLineAtOffset(0, 100)
    expect(state.loopEnabled.value).toBe(true)
    await state.playLineAtOffset(1, 100, { continuePlayback: true })
    expect(state.loopEnabled.value).toBe(false)
    expect(controls.seek).toHaveBeenLastCalledWith(4.1)
    scope.stop()
  })

  it.each(['source', 'dispose', 'timing'])(
    'cancels a pending phrase replay when %s changes',
    async change => {
      const { state, controls, scope } = player()
      let finish
      controls.resume.mockImplementation(
        () =>
          new Promise(resolve => {
            finish = resolve
          })
      )
      const pending = state.playLine(0)
      if (change === 'source') {
        controls.audioSource.value = { type: 'library', id: 2 }
        controls.playingTrack.value = { id: 2 }
      } else if (change === 'dispose') scope.stop()
      else controls.syncedLines.value[0] = { ...line(), start_ms: 1200 }
      finish()
      await pending
      expect(controls.seek).not.toHaveBeenCalled()
      scope.stop()
    }
  )

  it('keeps the newest replay request instead of seeking back when an older resume finishes', async () => {
    const { state, controls, scope } = player()
    const finish = []
    controls.resume.mockImplementation(
      () =>
        new Promise(resolve => {
          finish.push(resolve)
        })
    )
    const first = state.playLine(0)
    const second = state.playLine(1)
    finish[1]()
    await second
    finish[0]()
    await first
    expect(controls.seek).toHaveBeenCalledExactlyOnceWith(4)
    scope.stop()
  })

  it('reports failed phrase seeks and play/resume without unhandled rejections', async () => {
    const { state, controls, scope } = player()
    controls.seek.mockRejectedValue(new Error('Seek unavailable'))
    await state.playLine(0)
    expect(controls.onError).toHaveBeenCalledOnce()
    controls.resume.mockRejectedValue(new Error('Resume unavailable'))
    await state.resumeOrPlay()
    expect(controls.onError).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('does not seek after a pending resume is canceled or the recording changes', async () => {
    for (const changeSource of [false, true]) {
      const { state, controls, scope } = player()
      let finish
      controls.resume.mockImplementation(
        () =>
          new Promise(resolve => {
            finish = resolve
          })
      )
      const starting = state.toggleLoop()
      if (changeSource) controls.audioSource.value = { type: 'library', id: 2 }
      else await state.toggleLoop()
      finish()
      await starting
      expect(state.loopEnabled.value).toBe(false)
      expect(controls.seek).not.toHaveBeenCalled()
      scope.stop()
    }
  })

  it('reports failed loop seeks once and stops without an unhandled rejection', async () => {
    const { state, controls, scope } = player()
    await state.toggleLoop()
    controls.seek.mockRejectedValue(new Error('Audio unavailable'))
    controls.status.value = 'playing'
    controls.progress.value = 2
    await nextTick()
    await Promise.resolve()
    expect(state.loopEnabled.value).toBe(false)
    expect(controls.onError).toHaveBeenCalledOnce()
    controls.progress.value = 3
    await nextTick()
    expect(controls.seek).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('stops looping when disposed or another track takes over even while paused', async () => {
    const { state, controls, scope } = player()
    await state.toggleLoop()
    controls.playingTrack.value = { id: 2 }
    await nextTick()
    expect(state.loopEnabled.value).toBe(false)
    controls.playingTrack.value = { id: 1 }
    await state.toggleLoop()
    scope.stop()
    expect(state.loopEnabled.value).toBe(false)
  })

  it('plays with context and seeks only once until the player acknowledges the seek', async () => {
    const { state, controls, scope } = player()
    state.loopLeadSeconds.value = 1
    state.loopTailSeconds.value = 0.5
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

  it('loops exactly over a pending marker pair, restores committed bounds on Cancel, and ignores stale previews', async () => {
    const { state, controls, scope } = player()
    expect(state.loopLeadSeconds.value).toBe(0)
    expect(state.loopTailSeconds.value).toBe(0)
    controls.markerPreview.value = {
      line: controls.syncedLines.value[0],
      lineIndex: 0,
      startMs: 1200,
      endMs: 1800,
    }
    await state.toggleLoop()
    expect(controls.seek).toHaveBeenLastCalledWith(1.2)
    controls.status.value = 'playing'
    controls.progress.value = 1.5
    await nextTick()
    controls.progress.value = 1.8
    await nextTick()
    expect(controls.seek).toHaveBeenLastCalledWith(1.2)
    controls.markerPreview.value = null
    controls.progress.value = 2
    await nextTick()
    expect(controls.seek).toHaveBeenLastCalledWith(1)
    controls.markerPreview.value = { line: {}, lineIndex: 0, startMs: 8000, endMs: 9000 }
    controls.progress.value = 1.1
    await nextTick()
    controls.progress.value = 2
    await nextTick()
    expect(controls.seek).toHaveBeenLastCalledWith(1)
    expect(controls.syncedLines.value[0]).toEqual(line())
    scope.stop()
  })
})

describe('editor exports', () => {
  it('captures submitted content and blocks duplicate exports during the save', async () => {
    let finish
    const content = ref('submitted document')
    const save = vi.fn(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
    const state = useEditLyricsV2Export({
      audioSource: ref({ type: 'library', id: 1 }),
      saveLyrics: save,
      serializedLyricsfile: content,
      toast,
    })
    invoke.mockResolvedValue([{ format: 'lrc', status: { type: 'success' } }])
    const exporting = state.exportLyrics({ syncedLrc: true })
    expect(await state.exportLyrics({ syncedLrc: true })).toBe(false)
    content.value = 'new unsaved edits'
    finish(true)
    expect(await exporting).toBe(true)
    expect(invoke).toHaveBeenCalledWith('export_lyrics', {
      trackId: 1,
      formats: ['lrc'],
      lyricsfile: 'submitted document',
    })
    expect(save).toHaveBeenCalledOnce()
    expect(state.isExporting.value).toBe(false)
  })

  it('reports which target failed and does not call a partial export complete', async () => {
    const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
    const state = useEditLyricsV2Export({
      audioSource: ref({ type: 'library', id: 1 }),
      saveLyrics: vi.fn().mockResolvedValue(true),
      serializedLyricsfile: ref('document'),
      toast,
    })
    invoke.mockResolvedValue([
      { format: 'lrc', status: { type: 'success' } },
      { format: 'embedded', status: { type: 'error', message: 'disk full' } },
    ])
    expect(await state.exportLyrics({ syncedLrc: true, embedIntoTrack: true })).toBe(false)
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('embedded: disk full'))
    expect(state.isExporting.value).toBe(false)
  })
})

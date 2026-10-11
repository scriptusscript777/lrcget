import { invoke } from '@tauri-apps/api/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  recoveryStorage,
  recoveryTarget,
  readRecovery,
  writeRecovery,
  removeRecovery,
} from '@/utils/editor-recovery.js'
import { useLyricHistory } from './useLyricHistory.js'
import { waveformMarkerBounds, waveformNeighborWarnings } from '@/utils/waveform-markers.js'
import {
  createSyncedLinesFromPlain,
  normalizeSyncedLine,
  parseLyricsfile,
  serializeLyricsfile,
} from '@/utils/lyricsfile.js'

const createEmptySyncedLine = () => ({
  text: '',
  words: [],
})

export function useEditLyricsV2Document({
  audioSource,
  lyricsfile,
  trackId,
  progress,
  playbackDuration,
  overlapPreference,
  toast,
  recoveryStore = recoveryStorage(),
  recoveryInstance = '',
}) {
  const plainLyrics = ref('')
  const syncedLines = ref([])
  const lyricsfileDocument = ref(null)
  const isDirty = ref(false)
  const isSaving = ref(false)
  const selectedSyncedLineIndex = ref(-1)
  const selectedSyncedLineIndices = ref([])
  const isSyncedLineEditing = ref(false)
  const isInstrumental = ref(false)
  const preventOverlaps = overlapPreference ?? ref(true)
  const timingStepMs = ref(100)
  const timingStep = () =>
    [10, 25, 50, 100].includes(Number(timingStepMs.value)) ? Number(timingStepMs.value) : 100
  const documentSnapshot = () =>
    JSON.stringify({
      plain: plainLyrics.value,
      synced: syncedLines.value,
      instrumental: isInstrumental.value,
    })
  const savedSnapshot = ref('')
  const recoveryStatus = ref('')
  const recoveryConflict = ref(null)
  const recoveryContext = ref({})
  const pendingSentence = ref(null)
  let recoveryKey = null
  let recoverySource = null
  let recoveryReady = false
  const recoveryBlocked = ref(false)
  const workingDocument = () => {
    const doc = JSON.parse(documentSnapshot())
    const pending = pendingSentence.value
    const line = doc.synced[pending?.lineIndex]
    if (
      line &&
      pending.originalText === line.text &&
      typeof pending.text === 'string' &&
      pending.text !== line.text
    ) {
      line.text = pending.text
      line.words = []
    }
    return doc
  }
  const hasUnsavedDocument = computed(() => JSON.stringify(workingDocument()) !== savedSnapshot.value)
  const hasRecoveryWork = computed(() => hasUnsavedDocument.value || !!recoveryContext.value.markerPreview)
  const flushRecovery = () => {
    if (!recoveryReady) return true
    if (recoveryBlocked.value || recoveryConflict.value) return false
    try {
      if (!hasRecoveryWork.value) {
        removeRecovery(recoveryStore, recoveryKey)
        recoveryStatus.value = ''
      } else {
        writeRecovery(recoveryStore, recoveryKey, {
          baseline: savedSnapshot.value,
          document: workingDocument(),
          context: recoveryContext.value,
          source: recoverySource,
        })
        recoveryStatus.value = ''
      }
      return true
    } catch (error) {
      recoveryStatus.value = `Recovery unavailable: ${error.message}`
      return false
    }
  }
  const restoreRecovery = () => {
    const record = recoveryConflict.value
    if (!record) return
    recoveryReady = false
    plainLyrics.value = record.document.plain
    syncedLines.value = record.document.synced
    isInstrumental.value = record.document.instrumental
    recoveryContext.value =
      record.context && typeof record.context === 'object' ? record.context : {}
    if (Number.isInteger(recoveryContext.value.selectedLineIndex))
      selectedSyncedLineIndex.value = recoveryContext.value.selectedLineIndex
    ensureSelectedSyncedLine()
    recoveryConflict.value = null
    isDirty.value = documentSnapshot() !== savedSnapshot.value
    history.reset()
    recoveryReady = true
    recoveryStatus.value = 'Recovered unfinished work'
    // Keep the draft durable; adopt the current saved baseline after explicit conflict restore.
    flushRecovery()
    recoveryStatus.value = 'Recovered unfinished work'
  }
  const discardRecovery = (abandon = false) => {
    try {
      removeRecovery(recoveryStore, recoveryKey)
      recoveryConflict.value = null
      recoveryBlocked.value = false
      recoveryStatus.value = ''
      if (abandon === true) recoveryReady = false
      return true
    } catch (error) {
      recoveryStatus.value = `Recovery unavailable: ${error.message}`
      return false
    }
  }
  const resetLyricsProject = mode => {
    if (isSaving.value || !['saved', 'timing'].includes(mode)) return false
    const working = workingDocument()
    try {
      // Delete only this target; if removal fails, preserve the current editor.
      if (recoveryStore && recoveryKey) removeRecovery(recoveryStore, recoveryKey)
    } catch (error) {
      recoveryStatus.value = `Recovery unavailable: ${error.message}`
      return false
    }
    const doc = mode === 'saved' ? JSON.parse(savedSnapshot.value) : working
    recoveryReady = false
    pendingSentence.value = null
    recoveryConflict.value = null
    recoveryBlocked.value = false
    recoveryContext.value = {}
    recoveryStatus.value = ''
    plainLyrics.value = doc.plain
    syncedLines.value = mode === 'saved' ? doc.synced :
      (doc.synced.length ? doc.synced : createSyncedLinesFromPlain(doc.plain, [])).map(line => ({ text: line.text, words: [] }))
    isInstrumental.value = mode === 'saved' ? doc.instrumental : false
    selectedSyncedLineIndex.value = -1
    clearSyncedLineSelection()
    ensureSelectedSyncedLine()
    isSyncedLineEditing.value = false
    isDirty.value = documentSnapshot() !== savedSnapshot.value
    history.reset()
    recoveryReady = true
    flushRecovery()
    return true
  }
  const updateRecoveryContext = context => {
    recoveryContext.value = { ...recoveryContext.value, ...context }
  }
  const updatePendingSentence = pending => {
    pendingSentence.value = pending
  }
  watch(
    [plainLyrics, syncedLines, isInstrumental, pendingSentence, recoveryContext],
    flushRecovery,
    { deep: true, flush: 'sync' }
  )
  onScopeDispose(flushRecovery)
  const history = useLyricHistory(
    () => ({ lines: syncedLines.value, instrumental: isInstrumental.value }),
    state => {
      syncedLines.value = state.lines
      isInstrumental.value = state.instrumental
      clearSyncedLineSelection()
      ensureSelectedSyncedLine()
      isDirty.value = documentSnapshot() !== savedSnapshot.value
    }
  )

  const clearSyncedLineSelection = () => {
    selectedSyncedLineIndices.value = []
  }

  const ensureSelectedSyncedLine = () => {
    if (syncedLines.value.length === 0) {
      selectedSyncedLineIndex.value = -1
      clearSyncedLineSelection()
      return
    }

    if (
      !Number.isInteger(selectedSyncedLineIndex.value) ||
      selectedSyncedLineIndex.value < 0 ||
      selectedSyncedLineIndex.value >= syncedLines.value.length
    ) {
      // Initial markers belong to the first timed lyric, not an intro clear cue.
      const firstTimedLyric = syncedLines.value.findIndex(
        line => line.text?.trim() && Number.isFinite(line.start_ms) && line.start_ms >= 0
      )
      selectedSyncedLineIndex.value = firstTimedLyric >= 0 ? firstTimedLyric : 0
    }

    // Remove any out-of-bounds indices from multi-selection
    selectedSyncedLineIndices.value = selectedSyncedLineIndices.value.filter(
      i => i >= 0 && i < syncedLines.value.length
    )
  }

  const selectSyncedLine = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    selectedSyncedLineIndex.value = lineIndex
    clearSyncedLineSelection()
  }

  const selectSyncedLineRange = (start, end) => {
    if (syncedLines.value.length === 0) {
      clearSyncedLineSelection()
      return
    }
    const min = Math.max(0, Math.min(start, end))
    const max = Math.min(syncedLines.value.length - 1, Math.max(start, end))
    const indices = []
    for (let i = min; i <= max; i++) {
      indices.push(i)
    }
    selectedSyncedLineIndices.value = indices
    selectedSyncedLineIndex.value = min
  }

  const toggleSyncedLineSelection = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }
    const current = new Set(selectedSyncedLineIndices.value)
    if (current.has(lineIndex)) {
      current.delete(lineIndex)
    } else {
      current.add(lineIndex)
    }
    selectedSyncedLineIndices.value = Array.from(current).sort((a, b) => a - b)
    if (selectedSyncedLineIndices.value.length > 0) {
      selectedSyncedLineIndex.value = selectedSyncedLineIndices.value[0]
    }
  }

  const setSyncedLineEditingState = value => {
    isSyncedLineEditing.value = value
  }

  const initializeLyrics = () => {
    recoveryReady = false
    history.clear()
    // Get lyrics content from lyricsfile prop, or empty string if none
    const lyricsfileContent = lyricsfile.value?.content ?? ''

    const parsed = parseLyricsfile(lyricsfileContent)

    plainLyrics.value = parsed.plainLyrics
    // Load synced lines independently from plain lyrics
    // This allows users to have different structures (e.g., annotations, empty lines)
    syncedLines.value = parsed.syncedLines.map(line => normalizeSyncedLine(line))
    isInstrumental.value = parsed.isInstrumental

    lyricsfileDocument.value = parsed.document
    isDirty.value = false
    isSyncedLineEditing.value = false
    ensureSelectedSyncedLine()
    savedSnapshot.value = documentSnapshot()
    history.reset()
    recoveryKey = recoveryTarget(
      audioSource.value,
      lyricsfile.value,
      trackId?.value,
      recoveryInstance
    )
    recoverySource = JSON.parse(
      JSON.stringify({
        audioSource: audioSource.value,
        trackId: trackId?.value ?? null,
        lyricsfileId: lyricsfile.value?.id ?? null,
      })
    )
    recoveryReady = false
    recoveryBlocked.value = false
    recoveryConflict.value = null
    pendingSentence.value = null
    recoveryContext.value = {}
    recoveryStatus.value = ''
    try {
      const record = readRecovery(recoveryStore, recoveryKey)
      if (record) {
        recoveryConflict.value = record
        if (record.baseline === savedSnapshot.value) restoreRecovery()
        else
          recoveryStatus.value =
            'Saved lyrics changed since this recovery draft. Choose which work to keep.'
      }
    } catch (error) {
      recoveryBlocked.value = true
      recoveryStatus.value = `Recovery unavailable: ${error.message}`
    }
    recoveryReady = true
  }

  const updatePlainLyrics = lyrics => {
    plainLyrics.value = lyrics
    // Plain and synced lyrics are now independent - editing plain lyrics
    // does not automatically update synced lines, allowing users to have
    // different structures (e.g., annotations like [chorus], empty lines)
    isDirty.value = true
  }

  const updateSyncedLines = lines => {
    syncedLines.value = lines
    isDirty.value = true
    ensureSelectedSyncedLine()
  }

  const addSyncedLineAt = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex > syncedLines.value.length) {
      return
    }

    const nextLines = [...syncedLines.value]
    nextLines.splice(lineIndex, 0, createEmptySyncedLine())

    syncedLines.value = nextLines
    selectedSyncedLineIndex.value = lineIndex
    clearSyncedLineSelection()
    isDirty.value = true
  }

  const deleteSyncedLine = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    syncedLines.value = syncedLines.value.filter((_, index) => index !== lineIndex)
    isDirty.value = true
    clearSyncedLineSelection()

    if (syncedLines.value.length === 0) {
      selectedSyncedLineIndex.value = -1
      return
    }

    selectedSyncedLineIndex.value = Math.min(lineIndex, syncedLines.value.length - 1)
  }

  const bulkDeleteLines = indices => {
    if (!Array.isArray(indices) || indices.length === 0) {
      return
    }
    const indexSet = new Set(indices)
    const nextLines = syncedLines.value.filter((_, index) => !indexSet.has(index))
    syncedLines.value = nextLines
    isDirty.value = true
    clearSyncedLineSelection()

    if (syncedLines.value.length === 0) {
      selectedSyncedLineIndex.value = -1
      return
    }

    // Pick the first non-deleted line at or after the first deleted index
    const firstDeleted = Math.min(...indices)
    selectedSyncedLineIndex.value = Math.min(firstDeleted, syncedLines.value.length - 1)
  }

  const bulkShiftLineTimestamps = (indices, offsetMs) => {
    if (!Array.isArray(indices) || indices.length === 0) {
      return
    }
    const indexSet = new Set(indices)
    const nextLines = syncedLines.value.map((line, index) => {
      if (!indexSet.has(index)) {
        return line
      }
      const currentStartMs = line?.start_ms
      const baseStartMs = Number.isFinite(currentStartMs) ? currentStartMs : 0
      const newStartMs = Math.max(0, Math.round(baseStartMs + offsetMs))
      return moveLineTo(line, newStartMs)
    })
    if (
      [...indexSet].some(
        index =>
          !nextLines[index] ||
          !validTimingChange(index, nextLines[index], nextLines, nextLines[index].start_ms)
      )
    )
      return false
    syncedLines.value = nextLines
    isDirty.value = true
    return true
  }

  const bulkRewindLines = indices => {
    bulkShiftLineTimestamps(indices, -timingStep())
  }

  const bulkForwardLines = indices => {
    bulkShiftLineTimestamps(indices, timingStep())
  }

  const importSyncedLinesFromPlain = () => {
    if (!hasPlainLyrics.value) {
      return
    }

    syncedLines.value = createSyncedLinesFromPlain(plainLyrics.value, [])
    isDirty.value = true
    ensureSelectedSyncedLine()
  }

  const withUpdatedLine = (lineIndex, updater) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const nextLines = syncedLines.value.map((line, index) => {
      if (index !== lineIndex) {
        return line
      }

      return updater(line)
    })

    syncedLines.value = nextLines
    isDirty.value = true
  }

  const eraseWordTimings = lineIndex => {
    withUpdatedLine(lineIndex, line => ({
      ...line,
      words: [],
    }))
  }

  const shiftWordBoundariesByOffset = (words, offsetMs) => {
    if (
      !Array.isArray(words) ||
      words.length === 0 ||
      !Number.isFinite(offsetMs) ||
      offsetMs === 0
    ) {
      return words
    }

    return words.map(word => ({
      ...word,
      ...(Number.isFinite(word?.start_ms)
        ? { start_ms: Math.max(0, Math.round(word.start_ms + offsetMs)) }
        : {}),
      ...(Number.isFinite(word?.end_ms)
        ? { end_ms: Math.max(0, Math.round(word.end_ms + offsetMs)) }
        : {}),
    }))
  }

  const moveLineTo = (line, startMs) => {
    const offset = startMs - (Number.isFinite(line.start_ms) ? line.start_ms : 0)
    return {
      ...line,
      start_ms: startMs,
      ...(Number.isFinite(line.end_ms) ? { end_ms: Math.max(0, line.end_ms + offset) } : {}),
      words: shiftWordBoundariesByOffset(line.words, offset),
    }
  }

  const updateWaveformMarkers = ({ lineIndex, line: original, startMs, endMs, durationMs }) => {
    const line = syncedLines.value[lineIndex]
    if (
      !Number.isInteger(lineIndex) ||
      !line ||
      line !== original ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0
    )
      return
    const oldEnd = line.end_ms ?? syncedLines.value[lineIndex + 1]?.start_ms ?? durationMs
    if (Number.isFinite(line.start_ms) && !waveformMarkerBounds(line, oldEnd, durationMs))
      return false
    const start = Math.round(startMs)
    const end = Math.round(endMs)
    if (start === line.start_ms && end === oldEnd) return
    const next = {
      ...line,
      start_ms: start,
      end_ms: end,
      words: shiftWordBoundariesByOffset(line.words, start - (line.start_ms ?? start)),
    }
    // Validate the pair together and record one undo step; never partially apply a draft.
    if (!waveformMarkerBounds(next, end, durationMs) || !validTimingChange(lineIndex, next))
      return false
    withUpdatedLine(lineIndex, () => next)
    return true
  }

  // Buttons and keyboard timing actions use the same bounds as waveform markers.
  const recordingDurationMs = () => {
    const seconds =
      Number.isFinite(playbackDuration?.value) && playbackDuration.value > 0
        ? playbackDuration.value
        : audioSource.value?.duration
    return Number.isFinite(seconds) ? seconds * 1000 : NaN
  }
  const validTimingChange = (
    lineIndex,
    line,
    lines = syncedLines.value,
    priorStart = syncedLines.value[lineIndex]?.start_ms
  ) => {
    const durationMs = recordingDurationMs()
    const endMs = line.end_ms ?? lines[lineIndex + 1]?.start_ms ?? durationMs
    if (!waveformMarkerBounds(line, endMs, durationMs)) {
      toast.error(
        'Timing not changed: keep start before end and all timed words inside the sentence and recording.'
      )
      return false
    }
    if (preventOverlaps.value) {
      const warnings = waveformNeighborWarnings(
        { startMs: line.start_ms, endMs },
        lines[lineIndex - 1],
        priorStart,
        lines[lineIndex + 1]?.start_ms
      )
      if (warnings.length) {
        toast.error(
          `Timing not changed: ${warnings.join('; ')}. Adjust markers or turn off Prevent overlapping lyrics.`
        )
        return false
      }
    }
    return true
  }

  const playbackTimestamp = () => {
    if (!Number.isFinite(progress.value) || progress.value < 0) {
      toast.error('Play or seek this recording before syncing its timestamps.')
      return null
    }
    return Math.round(progress.value * 1000)
  }

  const applyLineWords = ({ lineIndex, words, lineStartMs }) => {
    const line = syncedLines.value[lineIndex]
    if (!Number.isInteger(lineIndex) || !line || !Array.isArray(words)) return false
    if (
      words.some(word => !word || typeof word.text !== 'string') ||
      (words.length && words.map(word => word.text).join('') !== line.text)
    )
      return false
    if (
      words.some((word, index) => {
        const previous = words[index - 1]
        const next = words[index + 1]
        return (
          !Number.isFinite(word.start_ms) ||
          (previous && word.start_ms <= previous.start_ms) ||
          (word.end_ms != null &&
            (!Number.isFinite(word.end_ms) ||
              word.end_ms <= word.start_ms ||
              (next && word.end_ms > next.start_ms)))
        )
      })
    )
      return false
    const nextLine = {
      ...line,
      ...(Number.isFinite(lineStartMs) ? { start_ms: Math.round(lineStartMs) } : {}),
      words,
    }
    if (!validTimingChange(lineIndex, nextLine)) return false
    withUpdatedLine(lineIndex, () => nextLine)
    return true
  }

  const updateLineWords = payload => {
    const accepted = applyLineWords(payload)
    if (typeof payload.onResult === 'function') payload.onResult(accepted)
    return accepted
  }

  const syncLineToCurrentProgress = (lineIndex, markerMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentLine = syncedLines.value[lineIndex]
    const previousStartMs = Number.isFinite(currentLine?.start_ms) ? currentLine.start_ms : null
    const newStartMs = Number.isFinite(markerMs) ? Math.round(markerMs) : playbackTimestamp()
    if (newStartMs == null) return false
    const lineStartOffsetMs = previousStartMs == null ? 0 : newStartMs - previousStartMs
    const nextLine = {
      ...currentLine,
      start_ms: newStartMs,
      words: shiftWordBoundariesByOffset(currentLine.words, lineStartOffsetMs),
    }
    if (!validTimingChange(lineIndex, nextLine)) return false

    // Update the current line's start_ms and optionally set previous line's end_ms
    const prevLineIndex = lineIndex - 1
    const shouldSetPrevEndMs =
      prevLineIndex >= 0 &&
      !Number.isFinite(syncedLines.value[prevLineIndex]?.end_ms) &&
      !!waveformMarkerBounds(syncedLines.value[prevLineIndex], newStartMs, recordingDurationMs())

    syncedLines.value = syncedLines.value.map((line, index) => {
      if (index === lineIndex) {
        return nextLine
      }
      if (index === prevLineIndex && shouldSetPrevEndMs) {
        return {
          ...line,
          end_ms: newStartMs,
        }
      }
      return line
    })
    isDirty.value = true
    return true
  }

  const shiftLineTimestampBy = (lineIndex, offsetMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentStartMs = syncedLines.value[lineIndex]?.start_ms
    const baseStartMs = Number.isFinite(currentStartMs) ? currentStartMs : 0
    const newStartMs = Math.max(0, Math.round(baseStartMs + offsetMs))

    const nextLine = moveLineTo(syncedLines.value[lineIndex], newStartMs)
    if (!validTimingChange(lineIndex, nextLine)) return false
    withUpdatedLine(lineIndex, () => nextLine)
    return true
  }

  const rewindLineBy100 = lineIndex => {
    return shiftLineTimestampBy(lineIndex, -timingStep())
  }

  const forwardLineBy100 = lineIndex => {
    return shiftLineTimestampBy(lineIndex, timingStep())
  }

  const syncEndToCurrentProgress = (lineIndex, markerMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    if (!Number.isFinite(syncedLines.value[lineIndex].start_ms)) {
      toast.error('Confirm a sentence start before confirming its end.')
      return false
    }

    const newEndMs = Number.isFinite(markerMs) ? Math.round(markerMs) : playbackTimestamp()
    if (newEndMs == null) return false
    const nextLine = { ...syncedLines.value[lineIndex], end_ms: newEndMs }
    if (!validTimingChange(lineIndex, nextLine)) return false
    withUpdatedLine(lineIndex, () => nextLine)
    return true
  }

  const shiftEndTimestampBy = (lineIndex, offsetMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentEndMs = syncedLines.value[lineIndex]?.end_ms
    const baseEndMs = Number.isFinite(currentEndMs) ? currentEndMs : 0
    const newEndMs = Math.max(0, Math.round(baseEndMs + offsetMs))

    const nextLine = { ...syncedLines.value[lineIndex], end_ms: newEndMs }
    if (!validTimingChange(lineIndex, nextLine)) return false
    withUpdatedLine(lineIndex, () => nextLine)
    return true
  }

  const rewindEndBy100 = lineIndex => {
    return shiftEndTimestampBy(lineIndex, -timingStep())
  }

  const forwardEndBy100 = lineIndex => {
    return shiftEndTimestampBy(lineIndex, timingStep())
  }

  const updateLineText = (lineIndex, newText) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const line = syncedLines.value[lineIndex]
    if (!line || line.text === newText) {
      return
    }

    withUpdatedLine(lineIndex, currentLine => ({
      ...currentLine,
      text: newText,
      words: [],
    }))
  }

  const updateWordText = ({ lineIndex, line: original, wordIndex, text, words }) => {
    const line = syncedLines.value[lineIndex]
    if (
      !Number.isInteger(lineIndex) ||
      !line ||
      line !== original ||
      !Number.isInteger(wordIndex) ||
      !Array.isArray(words) ||
      wordIndex < 0 ||
      wordIndex >= words.length ||
      typeof text !== 'string'
    )
      return false
    const replacement = text.trim()
    if (
      !replacement ||
      /\s/.test(replacement) ||
      words.some(word => !word || typeof word.text !== 'string') ||
      words.map(word => word.text).join('') !== line.text
    )
      return false
    // Reject stale saved timing snapshots; generated word timings are allowed only for this exact line.
    if (
      Array.isArray(line.words) &&
      line.words.length &&
      line.words.every(word => word && Number.isFinite(word.start_ms)) &&
      line.words.map(word => word.text).join('') === line.text &&
      (line.words.length !== words.length ||
        line.words.some(
          (word, index) =>
            word.text !== words[index].text ||
            word.start_ms !== words[index].start_ms ||
            word.end_ms !== words[index].end_ms
        ))
    )
      return false
    const oldText = words[wordIndex].text
    const nextText =
      (oldText.match(/^\s*/)?.[0] || '') + replacement + (oldText.match(/\s*$/)?.[0] || '')
    if (nextText === oldText) return true
    const nextWords = words.map((word, index) => ({
      ...word,
      ...(index === wordIndex ? { text: nextText } : {}),
    }))
    const end = line.end_ms
    const durationMs = Number.isFinite(audioSource?.value?.duration)
      ? audioSource.value.duration * 1000
      : end
    if (!waveformMarkerBounds({ ...line, words: nextWords }, end, durationMs)) return false
    withUpdatedLine(lineIndex, current => ({
      ...current,
      text: nextWords.map(word => word.text).join(''),
      words: nextWords,
    }))
    return true
  }

  const setInstrumental = value => {
    isInstrumental.value = Boolean(value)
    isDirty.value = true
  }

  const saveLyrics = async () => {
    if (isSaving.value) return false
    if (recoveryConflict.value || recoveryBlocked.value) {
      toast.error('Resolve the recovery draft before saving these lyrics.')
      return false
    }
    const pending = pendingSentence.value
    if (pending && syncedLines.value[pending.lineIndex]?.text === pending.originalText && typeof pending.text === 'string') {
      updateLineText(pending.lineIndex, pending.text)
      pendingSentence.value = null
    }
    if (!isDirty.value) {
      return true
    }

    isSaving.value = true
    try {
      const serializedContent = serializedLyricsfile.value
      const savingSnapshot = documentSnapshot()

      // Determine if this is a library track or a standalone lyricsfile
      // trackId is passed separately from audioSource to handle temporary associations
      // where a library track might be used for playback but the lyricsfile should not
      // be associated with the track (e.g., LRCLIB Browser flow)
      const isLibraryTrack = trackId?.value !== null && trackId?.value !== undefined

      if (isLibraryTrack) {
        // Library track: pass track_id (lyricsfile_id can be null if no lyricsfile exists yet)
        await invoke('save_lyrics', {
          trackId: trackId.value,
          lyricsfileId: lyricsfile?.value?.id ?? null,
          lyricsfile: serializedContent,
        })
      } else {
        // Standalone lyricsfile: pass lyricsfile_id (must not be null)
        const standaloneLyricsfileId = lyricsfile?.value?.id
        if (!standaloneLyricsfileId) {
          throw new Error('Standalone lyricsfile must have an ID')
        }
        await invoke('save_lyrics', {
          trackId: null,
          lyricsfileId: standaloneLyricsfileId,
          lyricsfile: serializedContent,
        })
      }

      // A save must not replace edits made while the backend was writing.
      lyricsfileDocument.value = parseLyricsfile(serializedContent).document
      savedSnapshot.value = savingSnapshot
      isDirty.value = documentSnapshot() !== savedSnapshot.value
      flushRecovery()
      return true
    } catch (error) {
      console.error(error)
      toast.error(error)
      return false
    } finally {
      isSaving.value = false
    }
  }

  const hasPlainLyrics = computed(() => plainLyrics.value.trim().length > 0)

  // Compute serialized lyricsfile content for export, publish, and debug
  const serializedLyricsfile = computed(() => {
    const working = workingDocument()
    // Build track data for serialization
    // Prefer existing lyricsfile metadata first, then fall back to audioSource/track data
    const trackData = {
      title: lyricsfileDocument?.value?.metadata?.title ?? audioSource.value?.title ?? null,
      artist_name:
        lyricsfileDocument?.value?.metadata?.artist ?? audioSource.value?.artist_name ?? null,
      album_name:
        lyricsfileDocument?.value?.metadata?.album ?? audioSource.value?.album_name ?? null,
      duration:
        (lyricsfileDocument?.value?.metadata?.duration_ms != null
          ? lyricsfileDocument.value.metadata.duration_ms / 1000
          : null) ??
        audioSource.value?.duration ??
        null,
    }

    return (
      serializeLyricsfile({
        track: trackData,
        plainLyrics: working.plain,
        syncedLines: working.synced,
        baseDocument: lyricsfileDocument.value,
        isInstrumental: isInstrumental.value,
      }) || ''
    )
  })

  const selectedLineExists = computed(
    () =>
      Number.isInteger(selectedSyncedLineIndex.value) &&
      selectedSyncedLineIndex.value >= 0 &&
      selectedSyncedLineIndex.value < syncedLines.value.length
  )

  watch(
    syncedLines,
    () => {
      ensureSelectedSyncedLine()
    },
    { deep: true }
  )

  return {
    recoveryBlocked,
    recoveryStatus,
    recoveryConflict,
    recoveryContext,
    hasUnsavedDocument,
    hasRecoveryWork,
    flushRecovery,
    restoreRecovery,
    discardRecovery,
    resetLyricsProject,
    updateRecoveryContext,
    updatePendingSentence,
    timingStepMs,
    preventOverlaps,
    updateWaveformMarkers,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    plainLyrics,
    syncedLines,
    lyricsfileDocument,
    isDirty,
    isSaving,
    selectedSyncedLineIndex,
    selectedSyncedLineIndices,
    isSyncedLineEditing,
    hasPlainLyrics,
    selectedLineExists,
    isInstrumental,
    serializedLyricsfile,
    initializeLyrics,
    updatePlainLyrics,
    updateSyncedLines,
    updateLineWords,
    selectSyncedLine,
    selectSyncedLineRange,
    toggleSyncedLineSelection,
    clearSyncedLineSelection,
    setSyncedLineEditingState,
    addSyncedLineAt,
    deleteSyncedLine,
    bulkDeleteLines,
    bulkRewindLines,
    bulkForwardLines,
    importSyncedLinesFromPlain,
    syncLineToCurrentProgress,
    rewindLineBy100,
    forwardLineBy100,
    syncEndToCurrentProgress,
    rewindEndBy100,
    forwardEndBy100,
    saveLyrics,
    ensureSelectedSyncedLine,
    updateLineText,
    updateWordText,
    eraseWordTimings,
    setInstrumental,
  }
}

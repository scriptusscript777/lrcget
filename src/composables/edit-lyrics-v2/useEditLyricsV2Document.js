import { invoke } from '@tauri-apps/api/core'
import { computed, ref, watch } from 'vue'
import { useLyricHistory } from './useLyricHistory.js'
import { waveformMarkerBounds } from '@/utils/waveform-markers.js'
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

export function useEditLyricsV2Document({ audioSource, lyricsfile, trackId, progress, toast }) {
  const plainLyrics = ref('')
  const syncedLines = ref([])
  const lyricsfileDocument = ref(null)
  const isDirty = ref(false)
  const isSaving = ref(false)
  const selectedSyncedLineIndex = ref(-1)
  const selectedSyncedLineIndices = ref([])
  const isSyncedLineEditing = ref(false)
  const isInstrumental = ref(false)
  const timingStepMs = ref(100)
  const timingStep = () =>
    [10, 25, 50, 100].includes(Number(timingStepMs.value)) ? Number(timingStepMs.value) : 100
  const documentSnapshot = () => JSON.stringify({
    plain: plainLyrics.value,
    synced: syncedLines.value,
    instrumental: isInstrumental.value,
  })
  let savedSnapshot = ''
  const history = useLyricHistory(
    () => ({ lines: syncedLines.value, instrumental: isInstrumental.value }),
    state => {
      syncedLines.value = state.lines
      isInstrumental.value = state.instrumental
      clearSyncedLineSelection()
      ensureSelectedSyncedLine()
      isDirty.value = documentSnapshot() !== savedSnapshot
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
      selectedSyncedLineIndex.value = 0
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
    history.clear()
    // Get lyrics content from lyricsfile prop, or empty string if none
    const lyricsfileContent = lyricsfile.value?.content ?? ''

    console.log(lyricsfileContent)
    const parsed = parseLyricsfile(lyricsfileContent)

    plainLyrics.value = parsed.plainLyrics
    // Load synced lines independently from plain lyrics
    // This allows users to have different structures (e.g., annotations, empty lines)
    syncedLines.value = parsed.syncedLines.map(line => normalizeSyncedLine(line))
    isInstrumental.value = parsed.isInstrumental

    lyricsfileDocument.value = parsed.document
    console.log(lyricsfileDocument.value)
    isDirty.value = false
    isSyncedLineEditing.value = false
    ensureSelectedSyncedLine()
    savedSnapshot = documentSnapshot()
    history.reset()
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
    syncedLines.value = nextLines
    isDirty.value = true
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
    if (!Array.isArray(words) || words.length === 0 || !Number.isFinite(offsetMs) || offsetMs === 0) {
      return words
    }

    return words.map(word => ({
      ...word,
      ...(Number.isFinite(word?.start_ms)
        ? { start_ms: Math.max(0, Math.round(word.start_ms + offsetMs)) } : {}),
      ...(Number.isFinite(word?.end_ms)
        ? { end_ms: Math.max(0, Math.round(word.end_ms + offsetMs)) } : {}),
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

  const updateWaveformMarker = ({ lineIndex, line: original, boundary, timeMs, durationMs }) => {
    const line = syncedLines.value[lineIndex]
    if (
      !Number.isInteger(lineIndex) || !line || line !== original ||
      !['start', 'end'].includes(boundary) || !Number.isFinite(timeMs) ||
      !Number.isFinite(durationMs) || durationMs <= 0
    ) return
    const endMs = line.end_ms ?? syncedLines.value[lineIndex + 1]?.start_ms ?? durationMs
    const bounds = waveformMarkerBounds(line, endMs, durationMs)?.[boundary]
    if (!bounds) return
    const next = Math.max(bounds.min, Math.min(bounds.max, Math.round(timeMs)))
    if (next === (boundary === 'start' ? line.start_ms : endMs)) return
    withUpdatedLine(lineIndex, current =>
      boundary === 'start'
        ? {
            ...current,
            start_ms: next,
            words: shiftWordBoundariesByOffset(current.words, next - current.start_ms),
          }
        : { ...current, end_ms: next }
    )
  }

  const syncLineToCurrentProgress = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentLine = syncedLines.value[lineIndex]
    const previousStartMs = Number.isFinite(currentLine?.start_ms) ? currentLine.start_ms : null
    const newStartMs = Math.max(0, Math.round(progress.value * 1000))
    const lineStartOffsetMs = previousStartMs == null ? 0 : newStartMs - previousStartMs

    // Update the current line's start_ms and optionally set previous line's end_ms
    const prevLineIndex = lineIndex - 1
    const shouldSetPrevEndMs =
      prevLineIndex >= 0 && !Number.isFinite(syncedLines.value[prevLineIndex]?.end_ms)

    syncedLines.value = syncedLines.value.map((line, index) => {
      if (index === lineIndex) {
        return {
          ...line,
          start_ms: newStartMs,
          words: shiftWordBoundariesByOffset(line.words, lineStartOffsetMs),
        }
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
  }

  const shiftLineTimestampBy = (lineIndex, offsetMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentStartMs = syncedLines.value[lineIndex]?.start_ms
    const baseStartMs = Number.isFinite(currentStartMs) ? currentStartMs : 0
    const newStartMs = Math.max(0, Math.round(baseStartMs + offsetMs))

    withUpdatedLine(lineIndex, line => moveLineTo(line, newStartMs))
  }

  const rewindLineBy100 = lineIndex => {
    shiftLineTimestampBy(lineIndex, -timingStep())
  }

  const forwardLineBy100 = lineIndex => {
    shiftLineTimestampBy(lineIndex, timingStep())
  }

  const syncEndToCurrentProgress = lineIndex => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const newEndMs = Math.max(0, Math.round(progress.value * 1000))

    withUpdatedLine(lineIndex, line => ({
      ...line,
      end_ms: newEndMs,
    }))
  }

  const shiftEndTimestampBy = (lineIndex, offsetMs) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= syncedLines.value.length) {
      return
    }

    const currentEndMs = syncedLines.value[lineIndex]?.end_ms
    const baseEndMs = Number.isFinite(currentEndMs) ? currentEndMs : 0
    const newEndMs = Math.max(0, Math.round(baseEndMs + offsetMs))

    withUpdatedLine(lineIndex, line => ({
      ...line,
      end_ms: newEndMs,
    }))
  }

  const rewindEndBy100 = lineIndex => {
    shiftEndTimestampBy(lineIndex, -timingStep())
  }

  const forwardEndBy100 = lineIndex => {
    shiftEndTimestampBy(lineIndex, timingStep())
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

  const setInstrumental = value => {
    isInstrumental.value = Boolean(value)
    isDirty.value = true
  }

  const saveLyrics = async () => {
    if (isSaving.value) return false
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
      savedSnapshot = savingSnapshot
      isDirty.value = documentSnapshot() !== savedSnapshot
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

    console.log(lyricsfileDocument.value)
    console.log(trackData)

    return (
      serializeLyricsfile({
        track: trackData,
        plainLyrics: plainLyrics.value,
        syncedLines: syncedLines.value,
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
    timingStepMs,
    updateWaveformMarker,
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
    eraseWordTimings,
    setInstrumental,
  }
}

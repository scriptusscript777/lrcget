<template>
  <BaseModal
    :click-to-close="false"
    :esc-to-close="false"
    content-class="w-full h-[95vh] max-w-screen-lg"
    body-class="grow"
    :title="modalTitle"
    @close="handleClose"
  >
    <template #titleLeft>
      <EditLyricsV2HeaderActions
        :is-dirty="isDirty || hasUnsavedDocument"
        :is-exporting="isExporting || isSaving"
        :can-master-reset="activeTab === 'synced' && !isInstrumental && !isImporting"
        @save="saveLyrics"
        @save-and-publish="saveAndPublish"
        @export="exportLyrics"
        @debug="openDebugModal"
        @master-reset="openProjectReset"
      />
    </template>

    <template #titleRight>
      <button
        class="button button-normal h-8 w-8 shrink-0 rounded-full p-1.5 text-sm mr-2"
        title="Import lyrics file"
        aria-label="Import lyrics file"
        :disabled="isSaving || isExporting || isImporting"
        @click="handleImportLrcFile"
      >
        <FileImport class="text-base" />
      </button>
      <div class="inline-flex gap-0.5">
        <button
          class="button text-sm h-8 w-24 rounded-l-full rounded-r-none"
          :class="
            isInstrumental
              ? 'button-disabled'
              : activeTab === 'plain'
                ? 'button-primary'
                : 'button-normal'
          "
          :disabled="isInstrumental"
          @click="activeTab = 'plain'"
        >
          Plain
        </button>
        <button
          class="button text-sm h-8 w-24 rounded-r-full rounded-l-none"
          :class="
            isInstrumental
              ? 'button-disabled'
              : activeTab === 'synced'
                ? 'button-primary'
                : 'button-normal'
          "
          :disabled="isInstrumental"
          @click="activeTab = 'synced'"
        >
          Synced
        </button>
      </div>

      <button
        class="button button-normal p-1.5 rounded-full text-sm h-8 w-8 ml-2"
        title="Keyboard shortcuts"
        @click="openShortcutsModal"
      >
        <Keyboard class="text-base" />
      </button>
    </template>

    <div class="grow flex flex-col gap-2 h-full">
      <div
        v-if="recoveryStatus"
        class="flex flex-wrap items-center gap-2 text-xs px-2 py-1 text-amber-800 dark:text-yellow-300"
        role="status"
      >
        <span>{{ recoveryStatus }}</span>
        <button v-if="recoveryBlocked" class="button button-normal rounded px-2 py-1" @click="discardRecovery">Discard unreadable recovery</button>
        <template v-if="recoveryConflict">
          <button class="button button-normal rounded px-2 py-1" @click="restoreRecoveryAndContext">
            Restore draft
          </button>
          <button class="button button-normal rounded px-2 py-1" @click="discardRecovery">
            Keep saved lyrics
          </button>
        </template>
      </div>
      <div
        class="toolbar bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
      >
        <EditLyricsV2PlayerBar
          :status="status"
          :duration="duration"
          :progress="progress"
          :playback-speed="playbackSpeed"
          @play-toggle="resumeOrPlay"
          @pause="pause"
          @seek="seek"
          @set-playback-speed="setPlaybackSpeed"
        />
        <EditLyricsV2Waveform
          ref="waveformEditor"
          :key="editorRevision"
          :recovery-markers="recoveryMarkerRequest"
          :prevent-overlaps="preventOverlaps"
          :audio-source="audioSource"
          :progress="waveformProgress"
          :playing="waveformPlaying"
          :loop-range="loopEnabled ? loopRange : null"
          :selected-line="
            activeTab === 'synced' && !isInstrumental ? syncedLines[selectedSyncedLineIndex] : null
          "
          :selected-line-index="selectedSyncedLineIndex"
          :next-line-start-ms="syncedLines[selectedSyncedLineIndex + 1]?.start_ms"
          :previous-line="syncedLines[selectedSyncedLineIndex - 1]"
          :timing-step-ms="timingStepMs"
          @preview-markers="handleMarkerPreview"
          @marker-editing-change="markerEditing = $event"
          @seek="handleWaveformSeek"
        />
      </div>

      <!-- Instrumental State -->
      <div v-if="isInstrumental" class="absolute bottom-16 left-1/2 -translate-x-1/2 px-3 z-10">
        <div
          class="w-full max-w-lg rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 shadow-lg"
        >
          <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-200">
            Track is marked as instrumental
          </h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              class="button button-normal px-2 py-1 text-xs rounded-full"
              @click="setInstrumental(false)"
            >
              Unmark as instrumental
            </button>
          </div>
        </div>
      </div>

      <PlainLyricsCodeEditor
        v-else-if="activeTab === 'plain'"
        :model-value="plainLyrics"
        :font-size="codemirrorStyle.fontSize"
        :synced-lines="syncedLines"
        @update:model-value="updatePlainLyrics"
        @change-font-size="changeCodemirrorFontSizeBy"
        @reset-font-size="resetCodemirrorFontSize"
        @mark-as-instrumental="setInstrumental(true)"
      />

      <SyncedLyricsEditor
        v-else
        :key="editorRevision"
        v-model:timing-step-ms="timingStepMs"
        v-model:loop-lead-seconds="loopLeadSeconds"
        v-model:loop-tail-seconds="loopTailSeconds"
        :prevent-overlaps="preventOverlaps"
        :marker-preview="markerPreview"
        :model-value="syncedLines"
        :can-import-from-plain="hasPlainLyrics"
        :selected-line-index="selectedSyncedLineIndex"
        :selected-line-indices="selectedSyncedLineIndices"
        :progress-ms="progressMs"
        :waveform-playing="waveformPlaying"
        :waveform-progress="waveformProgress"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :loop-enabled="loopEnabled"
        :loop-mode="loopMode"
        :word-timing-expanded="wordTimingExpanded"
        :recovery-word-selection="recoveryContext.wordSelection"
        :word-loop-target="wordLoopTarget"
        :can-loop="canPhraseLoop"
        :marker-editing="markerEditing"
        @word-timing-expanded-change="wordTimingExpanded = $event"
        @undo="undo"
        @redo="redo"
        @toggle-loop="toggleLoop('phrase')"
        @toggle-word-loop="toggleLoop('word')"
        @word-loop-target="handleWordLoopTarget"
        @recovery-edit-state="updatePendingSentence"
        @update:model-value="updateSyncedLines"
        @update:selected-line-index="selectSyncedLine"
        @update:selected-line-indices="handleUpdateSelectedLineIndices"
        @editing-state-change="setSyncedLineEditingState"
        @play-line="playLine"
        @pause="pause"
        @resume-playback="resumeOrPlay"
        @play-line-at-offset="handlePlayLineAtOffset"
        @sync-line="syncLineToCurrentProgress"
        @rewind-line="rewindLineBy100"
        @forward-line="forwardLineBy100"
        @sync-end="syncEndToCurrentProgress"
        @rewind-end="rewindEndBy100"
        @forward-end="forwardEndBy100"
        @delete-line="deleteSyncedLine"
        @bulk-rewind-lines="bulkRewindLines"
        @bulk-forward-lines="bulkForwardLines"
        @bulk-delete-lines="bulkDeleteLines"
        @add-line-at="addSyncedLineAt"
        @import-lines-from-plain="importSyncedLinesFromPlain"
        @import-lrc-file="handleImportLrcFile"
        @paste-lrc="handlePasteLrc"
        @update:words="updateLineWords"
        @word-timing-edited="handleWordTimingEdited"
        @update-line-text="handleUpdateLineText"
        @mark-as-instrumental="setInstrumental(true)"
      />
    </div>
  </BaseModal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useModal } from 'vue-final-modal'
import BaseModal from '@/components/common/BaseModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import EditLyricsV2DebugModal from '@/components/library/edit-lyrics-v2/EditLyricsV2DebugModal.vue'
import EditLyricsV2HeaderActions from '@/components/library/edit-lyrics-v2/EditLyricsV2HeaderActions.vue'
import EditLyricsV2PlayerBar from '@/components/library/edit-lyrics-v2/EditLyricsV2PlayerBar.vue'
import EditLyricsV2Waveform from '@/components/library/edit-lyrics-v2/EditLyricsV2Waveform.vue'
import PlainLyricsCodeEditor from '@/components/library/edit-lyrics-v2/PlainLyricsCodeEditor.vue'
import SyncedLyricsEditor from '@/components/library/edit-lyrics-v2/SyncedLyricsEditor.vue'
import KeyboardShortcutsModal from '@/components/library/edit-lyrics-v2/KeyboardShortcutsModal.vue'
import Keyboard from '~icons/mdi/keyboard'
import ResetLyricsProjectModal from '@/components/library/edit-lyrics-v2/ResetLyricsProjectModal.vue'
import FileImport from '~icons/mdi/file-import-outline'
import { useNativePlaybackLoop } from '@/composables/edit-lyrics-v2/useNativePlaybackLoop.js'
import { useEditLyricsV2Document } from '@/composables/edit-lyrics-v2/useEditLyricsV2Document.js'
import { useEditLyricsV2Hotkeys } from '@/composables/edit-lyrics-v2/useEditLyricsV2Hotkeys.js'
import { useEditLyricsV2Publish } from '@/composables/edit-lyrics-v2/useEditLyricsV2Publish.js'
import { useEditLyricsV2Playback } from '@/composables/edit-lyrics-v2/useEditLyricsV2Playback.js'
import { useEditLyricsV2Export } from '@/composables/edit-lyrics-v2/useEditLyricsV2Export.js'
import { useEditLyricsV2SyncedHotkeys } from '@/composables/edit-lyrics-v2/useEditLyricsV2SyncedHotkeys.js'
import { useGlobalState } from '@/composables/global-state.js'
import { usePlayer } from '@/composables/player.js'
import { open } from '@tauri-apps/plugin-dialog'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { invoke } from '@tauri-apps/api/core'
import { parseLrcLines } from '@/utils/lyricsfile.js'
import { parseImportedLyrics } from '@/utils/lyrics-import.js'
import { useWaveformPlayback } from '@/composables/edit-lyrics-v2/useWaveformPlayback.js'

const props = defineProps({
  // Audio source for playback (library track or file-based track)
  // Format: { type: 'library'|'file', id?, file_path?, duration?, title?, artist_name?, album_name?, ... }
  audioSource: {
    type: Object,
    required: true,
  },
  // Lyricsfile object for editing operations (save, debug, publish)
  // Format: { id?, content, metadata?: { title, artist, album, duration_ms } }
  // For library tracks, id is null and content comes from track.lyricsfile
  // For standalone lyricsfiles, id is the lyricsfiles table record ID
  lyricsfile: {
    type: Object,
    default: null,
  },
  // Track ID for save operations. Set for library tracks, null for temporary associations
  // This is separate from audioSource to handle the case where a library track is temporarily
  // associated with a standalone lyricsfile (e.g., LRCLIB Browser flow)
  trackId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['close'])

const { disableHotkey, enableHotkey, lrclibInstance, preventOverlaps: overlapPreference } = useGlobalState()
const {
  status,
  duration,
  progress,
  playbackSpeed,
  playingTrack,
  playTrack,
  pause,
  resume,
  seek,
  setPlaybackSpeed,
} = usePlayer()
const toast = useToast()

// Convert props to refs for composables
const audioSourceRef = toRef(props, 'audioSource')
const lyricsfileRef = toRef(props, 'lyricsfile')
const trackIdRef = toRef(props, 'trackId')

const {
  waveformProgress,
  waveformPlaying,
  initializeAudio,
  seekWaveform: handleWaveformSeek,
} = useWaveformPlayback({
  audioSource: audioSourceRef,
  playingTrack,
  status,
  progress,
  playTrack,
  seek,
  toast,
})

const progressMs = computed(() =>
  Number.isFinite(waveformProgress.value)
    ? Math.max(0, Math.round(waveformProgress.value * 1000))
    : -1
)

const activeTab = ref('plain')
const wordTimingExpanded = ref(false)
const {
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
  undo,
  redo,
  canUndo,
  canRedo,
  timingStepMs,
  preventOverlaps,
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
  syncLineToCurrentProgress: syncStartAt,
  rewindLineBy100: rewindLineTimestampBy100,
  forwardLineBy100: forwardLineTimestampBy100,
  syncEndToCurrentProgress: syncEndAt,
  rewindEndBy100,
  forwardEndBy100,
  saveLyrics,
  ensureSelectedSyncedLine,
  updateLineText,
  setInstrumental,
} = useEditLyricsV2Document({
  audioSource: audioSourceRef,
  lyricsfile: lyricsfileRef,
  trackId: trackIdRef,
  progress: waveformProgress,
  overlapPreference,
  recoveryInstance: lrclibInstance.value,
  playbackDuration: computed(() =>
    Number.isFinite(waveformProgress.value) ? duration.value : null
  ),
  toast,
})

const codemirrorStyle = ref({
  fontSize: 1.0,
})

const { saveAndPublish } = useEditLyricsV2Publish({
  audioSource: audioSourceRef,
  lyricsfileDocument: lyricsfileDocument,
  serializedLyricsfile,
  saveLyrics,
})

const { exportLyrics, isExporting } = useEditLyricsV2Export({
  audioSource: audioSourceRef,
  saveLyrics,
  serializedLyricsfile,
  toast,
})

const waveformEditor = ref(null)
const editorRevision = ref(0)
const recoveryMarkerRequest = ref(null)
const markerPreview = ref(null)
const handleMarkerPreview = preview => {
  const hadPreview = !!markerPreview.value
  markerPreview.value = preview
  if (preview || hadPreview) updateRecoveryContext({ markerPreview: preview ? {
    lineIndex: preview.lineIndex, lineText: preview.line?.text,
    startMs: preview.startMs, endMs: preview.endMs,
  } : null })
}
const confirmSentenceBoundary = (boundary, lineIndex) => {
  const commit = markerMs => {
    const action = boundary === 'start' ? syncStartAt : syncEndAt
    return action(lineIndex, markerMs) === true ? { line: syncedLines.value[lineIndex] } : false
  }
  return lineIndex === selectedSyncedLineIndex.value && waveformEditor.value
    ? waveformEditor.value.confirmBoundary(
        boundary,
        commit,
        syncedLines.value[lineIndex],
        lineIndex
      )
    : !!commit(undefined)
}
const syncLineToCurrentProgress = lineIndex => confirmSentenceBoundary('start', lineIndex)
const syncEndToCurrentProgress = lineIndex => confirmSentenceBoundary('end', lineIndex)
const markerEditing = ref(false)
const wordLoopTarget = ref(null)
const { setLoopRange } = useNativePlaybackLoop()
const {
  playLine,
  playLineAtOffset,
  resumeOrPlay,
  loopEnabled,
  loopMode,
  loopRange,
  loopLeadSeconds,
  loopTailSeconds,
  canPhraseLoop,
  toggleLoop,
} = useEditLyricsV2Playback({
  audioSource: audioSourceRef,
  syncedLines,
  progress,
  playingTrack,
  status,
  playTrack,
  resume,
  seek,
  duration,
  selectedLineIndex: selectedSyncedLineIndex,
  markerPreview,
  wordLoopTarget,
  wordLoopAvailable: wordTimingExpanded,
  loopAvailable: computed(() => activeTab.value === 'synced' && !isInstrumental.value),
  setLoopRange,
  onError: error => toast.error(`Loop playback failed: ${error?.message || error}`),
})

const handlePlayLineAtOffset = ({ lineIndex, offsetMs }) => {
  return playLineAtOffset(lineIndex, offsetMs)
}

const rewindLineBy100 = lineIndex => {
  if (rewindLineTimestampBy100(lineIndex) !== false) void playLineAtOffset(lineIndex)
}

const forwardLineBy100 = lineIndex => {
  if (forwardLineTimestampBy100(lineIndex) !== false) void playLineAtOffset(lineIndex)
}

const handleUpdateLineText = (lineIndex, newText) => {
  updateLineText(lineIndex, newText)
}
const handleUpdateSelectedLineIndices = payload => {
  if (payload?.clear) {
    clearSyncedLineSelection()
    return
  }
  if (typeof payload === 'number') {
    // Ctrl/Cmd toggle
    toggleSyncedLineSelection(payload)
    return
  }
  if (Number.isInteger(payload?.start) && Number.isInteger(payload?.end)) {
    selectSyncedLineRange(payload.start, payload.end)
  }
}

const isImporting = ref(false)
let importSession = 0
let importRequest = 0
let importDisposed = false
let pendingImport = null
const importContext = () => ({
  session: importSession,
  source: props.audioSource,
  lyricsfile: props.lyricsfile,
  trackId: props.trackId,
  document: serializedLyricsfile.value,
})
const isCurrentImport = context =>
  !importDisposed &&
  context.session === importSession &&
  context.source === props.audioSource &&
  context.lyricsfile === props.lyricsfile &&
  context.trackId === props.trackId &&
  context.document === serializedLyricsfile.value &&
  !isSaving.value &&
  !isExporting.value
const applyImportedLyrics = ({ parsed, context }) => {
  if (!isCurrentImport(context)) return
  if (parsed.kind === 'synced') updateSyncedLines(parsed.lines)
  updatePlainLyrics(parsed.plain)
  if (parsed.kind === 'plain') importSyncedLinesFromPlain()
  setInstrumental(false)
  activeTab.value = 'synced'
  toast.success(
    parsed.kind === 'synced'
      ? `Imported ${parsed.lines.length} synced lines`
      : 'Imported plain lyrics'
  )
}
const finishImportConfirmation = confirmed => {
  const request = pendingImport
  pendingImport = null
  isImporting.value = false
  closeImportConfirmModal()
  if (confirmed && request) applyImportedLyrics(request)
}
const { open: openImportConfirmModal, close: closeImportConfirmModal } = useModal({
  component: ConfirmModal,
  attrs: {
    title: 'Replace lyrics?',
    message:
      'Importing this file will replace the current plain lyrics and synced timings. Continue?',
    confirmText: 'Import lyrics',
    cancelText: 'Cancel',
    clickToClose: false,
    escToClose: false,
    onConfirm: () => finishImportConfirmation(true),
    onCancel: () => finishImportConfirmation(false),
  },
})
const invalidateImport = () => {
  importSession++
  if (pendingImport) finishImportConfirmation(false)
}
watch([audioSourceRef, lyricsfileRef, trackIdRef, serializedLyricsfile], invalidateImport, {
  deep: true,
  flush: 'sync',
})

const handleImportLrcFile = async () => {
  if (isImporting.value || isSaving.value || isExporting.value || importDisposed) return
  isImporting.value = true
  const requestId = ++importRequest
  const context = importContext()
  try {
    const filePath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Lyrics files', extensions: ['txt', 'lrc', 'elrc'] }],
    })

    if (!filePath || !isCurrentImport(context)) {
      return
    }

    const content = await invoke('read_text_file', { filePath })
    if (!isCurrentImport(context)) return
    const parsed = parseImportedLyrics(content, filePath)
    if (!parsed.plain.trim() && !parsed.lines.length) {
      toast.error('The selected lyrics file is empty')
      return
    }
    const request = { parsed, context }
    const replacesContent =
      plainLyrics.value.trim().length > 0 || syncedLines.value.length > 0 || isInstrumental.value
    if (replacesContent) {
      pendingImport = request
      await openImportConfirmModal()
    } else applyImportedLyrics(request)
  } catch (error) {
    if (isCurrentImport(context)) {
      pendingImport = null
      toast.error(error?.toString?.() || 'Failed to import lyrics file')
    }
  } finally {
    if (requestId === importRequest && !pendingImport) isImporting.value = false
  }
}

const handlePasteLrc = async () => {
  try {
    const text = await readText()
    if (!text || !text.trim()) {
      toast.error('Clipboard is empty')
      return
    }

    const parsedLines = parseLrcLines(text)

    if (parsedLines.length === 0) {
      toast.error('No valid synced lines found in clipboard')
      return
    }

    updateSyncedLines(parsedLines)
    toast.success(`Imported ${parsedLines.length} synced lines`)
  } catch (error) {
    console.error(error)
    toast.error(error?.toString?.() || 'Failed to paste LRC from clipboard')
  }
}

const handleWordTimingEdited = async ({ startMs }) => {
  if (loopEnabled.value && loopMode.value === 'word') return
  const index = selectedSyncedLineIndex.value
  const lineStartMs = syncedLines.value[index]?.start_ms
  if (!Number.isFinite(lineStartMs)) return
  await playLineAtOffset(index, Number.isFinite(startMs) ? startMs - lineStartMs : 0)
}

watch(activeTab, value => {
  if (value !== 'synced') {
    isSyncedLineEditing.value = false
    return
  }

  ensureSelectedSyncedLine()
})

const { bindSyncedHotkeys, unbindSyncedHotkeys } = useEditLyricsV2SyncedHotkeys({
  wordTimingExpanded,
  undo,
  redo,
  activeTab,
  isSyncedLineEditing,
  selectedLineExists,
  selectedSyncedLineIndex,
  selectedSyncedLineIndices,
  syncedLines,
  progressMs,
  selectSyncedLine,
  clearSyncedLineSelection,
  syncLineToCurrentProgress,
  syncEndToCurrentProgress,
  syncEndToTimestamp: syncEndAt,
  deleteSyncedLine,
  rewindLineBy100: rewindLineTimestampBy100,
  forwardLineBy100: forwardLineTimestampBy100,
  rewindEndBy100,
  forwardEndBy100,
  playLineAtOffset,
  playLine,
})

const changeCodemirrorFontSizeBy = offset => {
  const nextFontSize = Math.max(0.4, codemirrorStyle.value.fontSize + offset * 0.1)
  codemirrorStyle.value.fontSize = +nextFontSize.toFixed(2)
}

const resetCodemirrorFontSize = () => {
  codemirrorStyle.value.fontSize = 1.0
}

const debugModalContent = computed(() => {
  return serializedLyricsfile.value || ''
})

const { open: openDebugModal, close: closeDebugModal } = useModal({
  component: EditLyricsV2DebugModal,
  attrs: {
    content: debugModalContent,
    onClose() {
      closeDebugModal()
    },
  },
})

const { open: openShortcutsModal, close: closeShortcutsModal } = useModal({
  component: KeyboardShortcutsModal,
  attrs: {
    activeTab,
    onClose() {
      closeShortcutsModal()
    },
  },
})

const { open: openConfirmModal, close: closeConfirmModal } = useModal({
  component: ConfirmModal,
  attrs: {
    title: 'Unsaved Changes',
    message:
      'Recovery could not protect your unfinished work. Stay here and Save before closing, or discard these changes.',
    confirmText: 'Discard Changes',
    cancelText: 'Cancel',
    onConfirm() {
      closeConfirmModal()
      discardRecovery(true)
      emit('close')
    },
    onCancel() {
      closeConfirmModal()
    },
  },
})

let projectResetContext = null
const { open: openProjectResetModal, close: closeProjectResetModal } = useModal({
  component: ResetLyricsProjectModal,
  attrs: {
    onCancel: () => { projectResetContext = null; closeProjectResetModal() },
    onReset: ({ mode, onResult }) => {
      if (!projectResetContext || !isCurrentImport(projectResetContext) || isImporting.value || activeTab.value !== 'synced' || isInstrumental.value) {
        onResult(false, 'This lyrics project changed or is busy. Cancel and reopen Master reset.')
        return
      }
      const success = resetLyricsProject(mode)
      onResult(success)
      if (!success) return
      invalidateImport()
      loopEnabled.value = false
      wordLoopTarget.value = null
      recoveryMarkerRequest.value = null
      markerPreview.value = null
      wordTimingExpanded.value = false
      editorRevision.value++
      closeProjectResetModal()
    },
  },
})
const openProjectReset = () => {
  if (activeTab.value !== 'synced' || isInstrumental.value || isSaving.value || isExporting.value || isImporting.value) return
  projectResetContext = importContext()
  openProjectResetModal()
}

const handleClose = () => {
  if (isSaving.value || isExporting.value) {
    toast.info('Wait for the current save or export to finish before closing the editor.')
    return
  }
  invalidateImport()
  if ((isDirty.value || hasRecoveryWork.value) && !flushRecovery()) {
    openConfirmModal()
  } else {
    emit('close')
  }
}

const handleWordLoopTarget = target => {
  wordLoopTarget.value = target
  if (target) updateRecoveryContext({ wordSelection: { lineIndex: target.lineIndex, wordIndex: target.wordIndex } })
}

const applyRecoveryContext = () => {
  const context = recoveryContext.value
  recoveryMarkerRequest.value = context.markerPreview ?? null
  if (context.activeTab === 'synced' || context.activeTab === 'plain') activeTab.value = context.activeTab
  wordTimingExpanded.value = context.wordTimingExpanded === true
}
const restoreRecoveryAndContext = () => {
  restoreRecovery()
  applyRecoveryContext()
}

watch([activeTab, selectedSyncedLineIndex, wordTimingExpanded], () => {
  updateRecoveryContext({
    activeTab: activeTab.value,
    selectedLineIndex: selectedSyncedLineIndex.value,
    wordTimingExpanded: wordTimingExpanded.value,
  })
})

const modalTitle = computed(() => {
  const title =
    audioSourceRef.value?.title || lyricsfileRef.value?.metadata?.title || 'Unknown Title'
  const artist =
    audioSourceRef.value?.artist_name || lyricsfileRef.value?.metadata?.artist || 'Unknown Artist'
  return `${title} - ${artist}`
})

const { bindHotkeys, unbindHotkeys } = useEditLyricsV2Hotkeys({
  activeTab,
  saveLyrics,
  changeFontSizeBy: changeCodemirrorFontSizeBy,
  resetFontSize: resetCodemirrorFontSize,
  openShortcutsModal,
})

onMounted(() => {
  disableHotkey()

  // Initialize lyrics from props
  initializeLyrics()
  applyRecoveryContext()

  // Handle playback - ensure correct audio source is loaded
  void initializeAudio()

  bindHotkeys()
  bindSyncedHotkeys()
})

onUnmounted(() => {
  importDisposed = true
  invalidateImport()
  unbindSyncedHotkeys()
  unbindHotkeys()
  enableHotkey()
})
</script>

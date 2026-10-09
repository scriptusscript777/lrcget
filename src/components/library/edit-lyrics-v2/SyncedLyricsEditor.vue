<template>
  <div class="grow overflow-hidden flex flex-col relative">
    <div class="shrink-0 flex flex-wrap items-center gap-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
      <button class="button button-normal p-1.5 rounded disabled:opacity-40" title="Undo synced edit (Ctrl+Z)" :disabled="!canUndo || editingLineIndex !== null" @click="emit('undo')"><Undo /></button>
      <button class="button button-normal p-1.5 rounded disabled:opacity-40" title="Redo synced edit (Ctrl+Shift+Z)" :disabled="!canRedo || editingLineIndex !== null" @click="emit('redo')"><Redo /></button>
      <label class="text-xs inline-flex items-center gap-2">Timing step
        <!-- Shared styling also colors native dropdown options in dark mode. -->
        <select aria-label="Timing step" class="select select-xs [color-scheme:light] dark:[color-scheme:dark]" :value="timingStepMs" @change="emit('update:timing-step-ms', Number($event.target.value))">
          <option v-for="step in [10, 25, 50, 100]" :key="step" :value="step">{{ step }} ms</option>
        </select>
      </label>
      <button class="button p-1.5 rounded" :class="loopEnabled ? 'button-primary' : 'button-normal'" :disabled="!canLoop" :aria-pressed="loopEnabled" title="Loop selected phrase" @click="emit('toggle-loop')"><Repeat /></button>
      <label class="text-xs inline-flex items-center gap-1">Lead-in
        <input class="input w-14 rounded px-1 py-1 text-xs [color-scheme:light] dark:[color-scheme:dark]" type="number" min="0" max="5" step="0.1" :value="loopLeadSeconds" @change="emit('update:loop-lead-seconds', Number($event.target.value))">s
      </label>
      <label class="text-xs inline-flex items-center gap-1">Tail
        <input class="input w-14 rounded px-1 py-1 text-xs [color-scheme:light] dark:[color-scheme:dark]" type="number" min="0" max="5" step="0.1" :value="loopTailSeconds" @change="emit('update:loop-tail-seconds', Number($event.target.value))">s
      </label>
    </div>
    <div class="mt-2 flex shrink-0 flex-wrap items-center gap-2">
      <button
        class="button button-normal inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs"
        :aria-expanded="wordTimingExpanded"
        aria-controls="word-timing-panel"
        @click="wordTimingExpanded = !wordTimingExpanded"
      ><ChevronDown v-if="wordTimingExpanded" /><ChevronRight v-else />Word timing</button>
      <button
        v-if="wordTimingExpanded"
        type="button"
        class="button inline-flex items-center gap-1 rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
        :class="followLyrics ? 'bg-hoa-1500 text-white hover:bg-hoa-1400 dark:bg-hoa-1500 dark:text-white dark:hover:bg-hoa-1400' : 'button-normal'"
        :aria-pressed="followLyrics"
        :title="followLyrics ? 'Follow playback; hold the selected lyric during editing or loops' : 'Resume following the current lyric without seeking'"
        @click="followLyrics = !followLyrics"
      ><Crosshairs class="h-3.5 w-3.5" />Follow Lyrics</button>
    </div>
    <SyncedWordTimingLane
      v-if="wordTimingExpanded"
      id="word-timing-panel"
      class="relative z-20 shrink-0 mt-2"
      :selected-line="selectedLine"
      :has-selected-line="hasSelectedLine"
      :progress-ms="playbackTimeMs"
      :playing="waveformPlaying"
      :all-lines="modelValue"
      :selected-line-index="selectedLineIndex"
      @update:words="handleWordsUpdate"
      @word-timing-edited="handleWordTimingEdited"
      @play-line="handlePlayLine"
      @play-line-at-offset="handlePlayLineAtOffset"
      @select-next-line="selectLine(selectedLineIndex + 1)"
      @editing-change="wordEditing = $event"
      @word-text-editing-start="followLyrics = false"
      @edit-word-text="emit('edit-word-text', $event)"
    />

    <div
      ref="linesListElement"
      class="flex-1 overflow-y-auto py-4 relative z-0 outline-none"
      tabindex="0"
      @mousemove="handleMouseMove"
      @mouseleave="handleLinesMouseLeave"
      @scroll="handleLinesScroll"
      @click="handleContainerClick"
      @keydown.esc="handleEscKey"
    >
      <div>
        <SyncedInsertButton
          title="Add line before first"
          :opacity="insertControlOpacity(0)"
          @click="handleInsertButtonClick(0, $event)"
        />

        <div v-for="(line, index) in modelValue" :key="index">
          <SyncedLyricsLineRow
            :ref="component => setLineRowRef(component, index)"
            :line="line"
            :index="index"
            :row-class="rowClass(index)"
            :is-line-controls-visible="isLineControlsVisible(index)"
            :end-timestamp-diff-direction="getEndTimestampDiffDirection(index)"
            :is-editing="editingLineIndex === index"
            :editing-text="editingText"
            :timestamp-text="formatTimestampMs(line.start_ms)"
            :end-timestamp-text="formatTimestampMs(line.end_ms)"
            :set-line-input-ref="setLineInputRef"
            :progress-ms="progressMs"
            :timing-step-ms="timingStepMs"
            @mouseenter="hoveredLineIndex = index"
            @mouseleave="hoveredLineIndex = null"
            @select="selectLine"
            @mousedown-line="startDragSelection"
            @play-line="handlePlayLine"
            @sync-line="handleSyncLine"
            @rewind-line="handleRewindLine"
            @forward-line="handleForwardLine"
            @sync-end="handleSyncEnd"
            @rewind-end="handleRewindEnd"
            @forward-end="handleForwardEnd"
            @delete-line="handleDeleteLine"
            @start-edit="startEditingLine"
            @save-edit="saveEditingLine"
            @cancel-edit="cancelEditingLine"
            @update:editing-text="handleEditingTextUpdate"
          />

          <SyncedInsertButton
            v-if="index < modelValue.length - 1"
            title="Add line between"
            :opacity="insertControlOpacity(index + 1)"
            @click="handleInsertButtonClick(index + 1, $event)"
          />
        </div>

        <SyncedInsertButton
          title="Add line after last"
          :opacity="insertControlOpacity(modelValue.length)"
          @click="handleInsertButtonClick(modelValue.length, $event)"
        />
      </div>
    </div>

    <!-- Floating bulk actions toolbar -->
    <div
      v-if="hasMultiSelection"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-lg"
    >
      <span class="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        {{ selectedLineIndices.length }} lines selected
      </span>
      <div class="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />
      <button
        class="button button-normal p-1 rounded-full text-xs h-6 w-6"
        :title="`Rewind selected lines by ${timingStepMs}ms`"
        @click="handleBulkRewind"
      >
        <Rewind />
      </button>
      <button
        class="button button-normal p-1 rounded-full text-xs h-6 w-6"
        :title="`Forward selected lines by ${timingStepMs}ms`"
        @click="handleBulkForward"
      >
        <Forward />
      </button>
      <div class="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />
      <button
        class="button button-normal p-1 rounded-full text-xs h-6 w-6 text-red-500 dark:text-red-400"
        title="Delete selected lines"
        @click="handleBulkDelete"
      >
        <Trash />
      </button>
    </div>

    <SyncedLyricsEmptyState
      v-if="modelValue.length === 0"
      :can-import-from-plain="canImportFromPlain"
      @import-lines-from-plain="handleImportLinesFromPlain"
      @import-lrc-file="emit('import-lrc-file')"
      @paste-lrc="emit('paste-lrc')"
      @add-line-at="handleAddLineAt"
      @mark-as-instrumental="handleMarkAsInstrumental"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import Rewind from '~icons/mdi/rewind'
import Forward from '~icons/mdi/fast-forward'
import Trash from '~icons/mdi/trash-can'
import Undo from '~icons/mdi/undo'
import Redo from '~icons/mdi/redo'
import Repeat from '~icons/mdi/repeat'
import ChevronDown from '~icons/mdi/chevron-down'
import ChevronRight from '~icons/mdi/chevron-right'
import Crosshairs from '~icons/mdi/crosshairs'
import SyncedInsertButton from '@/components/library/edit-lyrics-v2/SyncedInsertButton.vue'
import SyncedLyricsEmptyState from '@/components/library/edit-lyrics-v2/SyncedLyricsEmptyState.vue'
import SyncedLyricsLineRow from '@/components/library/edit-lyrics-v2/SyncedLyricsLineRow.vue'
import SyncedWordTimingLane from '@/components/library/edit-lyrics-v2/SyncedWordTimingLane.vue'
import { useEditLyricsV2SyncedInlineEditing } from '@/composables/edit-lyrics-v2/useEditLyricsV2SyncedInlineEditing.js'
import { useEditLyricsV2SyncedInsertHover } from '@/composables/edit-lyrics-v2/useEditLyricsV2SyncedInsertHover.js'
import { useLyricsFollow } from '@/composables/edit-lyrics-v2/useLyricsFollow.js'
import { formatTimestampMs } from '@/utils/lyricsfile.js'

const props = defineProps({
  waveformPlaying: Boolean,
  waveformProgress: { type: Number, default: null },
  canUndo: Boolean,
  canRedo: Boolean,
  timingStepMs: { type: Number, default: 100 },
  loopEnabled: Boolean,
  markerEditing: Boolean,
  canLoop: Boolean,
  loopLeadSeconds: { type: Number, default: 1 },
  loopTailSeconds: { type: Number, default: 0.5 },
  modelValue: {
    type: Array,
    required: true,
  },
  selectedLineIndex: {
    type: Number,
    default: -1,
  },
  selectedLineIndices: {
    type: Array,
    default: () => [],
  },
  canImportFromPlain: {
    type: Boolean,
    default: false,
  },
  progressMs: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits([
  'word-timing-expanded-change',
  'undo',
  'redo',
  'update:timing-step-ms',
  'toggle-loop',
  'update:loop-lead-seconds',
  'update:loop-tail-seconds',
  'update:modelValue',
  'update:selected-line-index',
  'update:selected-line-indices',
  'play-line',
  'play-line-at-offset',
  'sync-line',
  'rewind-line',
  'forward-line',
  'sync-end',
  'rewind-end',
  'forward-end',
  'delete-line',
  'bulk-rewind-lines',
  'bulk-forward-lines',
  'bulk-delete-lines',
  'add-line-at',
  'import-lines-from-plain',
  'import-lrc-file',
  'paste-lrc',
  'editing-state-change',
  'update:words',
  'word-timing-edited',
  'edit-word-text',
  'update-line-text',
  'mark-as-instrumental',
])

const hoveredLineIndex = ref(null)
const wordTimingExpanded = ref(false)
const followLyrics = ref(true)
const wordEditing = ref(false)
const playbackTimeMs = computed(() => Number.isFinite(props.waveformProgress) ? props.waveformProgress * 1000 : -1)
watch(wordTimingExpanded, expanded => emit('word-timing-expanded-change', expanded), { flush: 'sync' })
const linesListElement = ref(null)
const modelValue = toRef(props, 'modelValue')

// Multi-selection drag state
const isDragging = ref(false)
const dragAnchorIndex = ref(-1)
const didJustDrag = ref(false)
const dragStartPos = ref(null)

const selectedIndexSet = computed(() => new Set(props.selectedLineIndices))
const hasMultiSelection = computed(() => props.selectedLineIndices.length >= 2)

const isLineRowSelected = index => selectedIndexSet.value.has(index)

const startDragSelection = (index, event) => {
  followLyrics.value = false
  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+click toggles individual line
    emit('update:selected-line-indices', index)
    return
  }

  didJustDrag.value = false
  dragStartPos.value = { x: event.clientX, y: event.clientY }
  isDragging.value = true
  dragAnchorIndex.value = index
  emit('update:selected-line-indices', { start: index, end: index })
}

const updateDragSelection = index => {
  if (!isDragging.value) {
    return
  }
  if (index !== dragAnchorIndex.value) {
    didJustDrag.value = true
  }
  emit('update:selected-line-indices', { start: dragAnchorIndex.value, end: index })
}

const endDragSelection = () => {
  isDragging.value = false
  dragAnchorIndex.value = -1
  dragStartPos.value = null
}

const handleMouseMove = event => {
  if (isDragging.value && dragStartPos.value) {
    const dx = Math.abs(event.clientX - dragStartPos.value.x)
    const dy = Math.abs(event.clientY - dragStartPos.value.y)
    if (dx > 5 || dy > 5) {
      didJustDrag.value = true
    }
  }
  handleLinesMouseMove(event)
}

const handleContainerClick = event => {
  // If a drag just finished, ignore the click so it doesn't clear the selection
  if (didJustDrag.value) {
    didJustDrag.value = false
    return
  }
  // Clicking empty space in the container clears multi-selection,
  // but clicks on line rows or buttons are ignored here.
  if (!event.target.closest('.group, button, input')) {
    emit('update:selected-line-indices', { clear: true })
  }
}

const handleEscKey = () => {
  emit('update:selected-line-indices', { clear: true })
}

const handleDocumentMouseUp = () => {
  endDragSelection()
}

onMounted(() => {
  document.addEventListener('mouseup', handleDocumentMouseUp)
})

onUnmounted(() => {
  emit('word-timing-expanded-change', false)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
})

const handleBulkRewind = () => {
  emit('bulk-rewind-lines', props.selectedLineIndices)
}

const handleBulkForward = () => {
  emit('bulk-forward-lines', props.selectedLineIndices)
}

const handleBulkDelete = () => {
  emit('bulk-delete-lines', props.selectedLineIndices)
}

const handleUpdateLineText = (lineIndex, newText) => {
  emit('update-line-text', lineIndex, newText)
}

const {
  editingLineIndex,
  editingText,
  setLineInputRef,
  startEditingLine,
  saveEditingLine,
  cancelEditingLine,
  handleLineCountChange: handleInlineEditingLineCountChange,
} = useEditLyricsV2SyncedInlineEditing({
  modelValue,
  emit,
  selectLine: index => selectLine(index),
  updateLineText: handleUpdateLineText,
})

useLyricsFollow({
  lines: modelValue,
  timeMs: playbackTimeMs,
  playing: toRef(props, 'waveformPlaying'),
  enabled: followLyrics,
  blocked: computed(() =>
    !wordTimingExpanded.value || props.loopEnabled || props.markerEditing ||
    editingLineIndex.value !== null || isDragging.value || hasMultiSelection.value || wordEditing.value
  ),
  selectedIndex: toRef(props, 'selectedLineIndex'),
  onSelect: index => emit('update:selected-line-index', index),
})

const {
  lineRowElements,
  setLineRowRef,
  insertControlOpacity,
  handleLinesMouseMove,
  handleLinesMouseLeave,
  handleLinesScroll,
  handleLineCountChange: handleInsertHoverLineCountChange,
} = useEditLyricsV2SyncedInsertHover({ modelValue })

const scrollLineIntoView = index => {
  if (!Number.isInteger(index) || index < 0) {
    return
  }

  if (!(linesListElement.value instanceof HTMLElement)) {
    return
  }

  const lineRowElement = lineRowElements.value[index]
  if (!(lineRowElement instanceof HTMLElement)) {
    return
  }

  lineRowElement.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}

const rowClass = index => {
  if (isLineRowSelected(index) || props.selectedLineIndex === index || editingLineIndex.value === index) {
    return 'bg-neutral-100 dark:bg-neutral-800'
  }

  if (hoveredLineIndex.value === index) {
    return 'bg-neutral-50 dark:bg-neutral-800/50'
  }

  return 'bg-transparent'
}

const selectLine = index => {
  followLyrics.value = false
  if (didJustDrag.value) {
    didJustDrag.value = false
    return
  }
  emit('update:selected-line-index', index)
}

const isLineControlsVisible = index =>
  hoveredLineIndex.value === index || props.selectedLineIndex === index || isLineRowSelected(index)

const getEndTimestampDiffDirection = index => {
  const lineEndMs = props.modelValue[index]?.end_ms
  const nextLineStartMs = props.modelValue[index + 1]?.start_ms

  if (!Number.isFinite(lineEndMs) || !Number.isFinite(nextLineStartMs) || lineEndMs === nextLineStartMs) {
    return null
  }

  return lineEndMs < nextLineStartMs ? 'before' : 'after'
}

const emitLineAction = (eventName, index, selectBefore = true) => {
  if (selectBefore) {
    selectLine(index)
  }

  emit(eventName, index)
}

const navigatePlayback = async (index, event, payload) => {
  const line = props.modelValue[index]
  if (!line) return
  // Play is navigation, not editing: select its markers and resume lyric following.
  followLyrics.value = false
  emit('update:selected-line-index', index)
  emit(event, payload)
  // Selection arrives through parent props; its manual-selection watcher must settle first.
  await nextTick()
  if (props.selectedLineIndex === index && props.modelValue[index] === line)
    followLyrics.value = true
}

const handlePlayLine = index => navigatePlayback(index, 'play-line', index)
const handlePlayLineAtOffset = payload =>
  navigatePlayback(payload?.lineIndex, 'play-line-at-offset', payload)

const handleSyncLine = index => {
  emitLineAction('sync-line', index)
}

const handleRewindLine = index => {
  emitLineAction('rewind-line', index)
}

const handleForwardLine = index => {
  emitLineAction('forward-line', index)
}

const handleSyncEnd = index => {
  emitLineAction('sync-end', index)
}

const handleRewindEnd = index => {
  emitLineAction('rewind-end', index)
}

const handleForwardEnd = index => {
  emitLineAction('forward-end', index)
}

const handleDeleteLine = index => {
  emitLineAction('delete-line', index, false)
}

const handleAddLineAt = index => {
  emit('add-line-at', index)
}

const handleInsertButtonClick = (index, event) => {
  event.stopPropagation()
  handleAddLineAt(index)
}

const handleImportLinesFromPlain = () => {
  emit('import-lines-from-plain')
}

const handleMarkAsInstrumental = () => {
  emit('mark-as-instrumental')
}

const handleEditingTextUpdate = value => {
  editingText.value = value
}

const handleWordsUpdate = ({ lineIndex, words, lineStartMs }) => {
  emit('update:words', { lineIndex, words, lineStartMs })
}

const handleWordTimingEdited = ({ lineIndex, startMs }) => {
  emit('word-timing-edited', { lineIndex, startMs })
}

const hasSelectedLine = computed(
  () => props.selectedLineIndex >= 0 && props.selectedLineIndex < props.modelValue.length
)

const selectedLine = computed(() => {
  if (!hasSelectedLine.value) return null
  return props.modelValue[props.selectedLineIndex]
})

watch(
  () => props.modelValue.length,
  lineCount => {
    handleInsertHoverLineCountChange(lineCount)
    handleInlineEditingLineCountChange(lineCount)
  }
)

watch(
  () => props.selectedLineIndex,
  (selectedLineIndex, previousLineIndex) => {
    if (selectedLineIndex === previousLineIndex) {
      return
    }

    nextTick(() => {
      scrollLineIntoView(selectedLineIndex)
    })
  }
)

watch(hoveredLineIndex, newIndex => {
  if (isDragging.value && Number.isInteger(newIndex)) {
    updateDragSelection(newIndex)
  }
})
</script>

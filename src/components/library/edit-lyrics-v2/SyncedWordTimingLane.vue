<template>
  <div
    class="relative z-20 flex min-w-0 flex-col px-2 py-2 rounded-lg overflow-visible"
    :class="hasSelectedLine ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-950'"
  >
    <!-- Empty state - no line selected -->
    <div v-if="!hasSelectedLine" class="flex items-center justify-center h-full">
      <span class="text-sm text-neutral-700 dark:text-neutral-400 italic">
        Select a lyric line to edit word timings
      </span>
    </div>

    <!-- Feature not available states -->
    <div v-else-if="!hasLineContent" class="flex items-center justify-center h-full">
      <span class="text-sm text-neutral-700 dark:text-neutral-400 italic">
        Add lyrics content to enable word timing
      </span>
    </div>

    <div v-else-if="!hasLineStartTime" class="flex items-center justify-center h-full">
      <span class="text-sm text-neutral-700 dark:text-neutral-400 italic">
        Sync the line (set start time) to enable word timing
      </span>
    </div>

    <div v-else-if="!hasLineEndTime" class="flex items-center justify-center h-full">
      <span class="text-sm text-neutral-700 dark:text-neutral-400 italic">
        Set the line end timestamp to define the timing window
      </span>
    </div>

    <!-- Word timing timeline -->
    <template v-else-if="isWordSyncAvailable">
      <!-- Header with line info -->
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-2 shrink-0">
        <div class="flex min-w-0 items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <span
            class="shrink-0 font-mono bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 rounded"
          >
            {{ formatTimestampMs(selectedLine.start_ms) }} -
            {{ formatTimestampMs(actualLineEndMs) }}
          </span>
          <span class="truncate max-w-[12rem]">{{ selectedLine.text || '(empty)' }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="!wordTextEdit"
            type="button"
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
            title="Edit selected word (F2 or right-click a word box)"
            :disabled="!words[selectedWordIndex] || !!dragState || !!dragStartPos"
            @click="startWordTextEdit(selectedWordIndex)"
          ><Pencil class="w-3.5 h-3.5" /><span>Edit word</span></button>
          <label class="inline-flex items-center gap-1" title="Word timing zoom">
            <Magnify class="h-3.5 w-3.5" />
            <input
              v-model.number="timelineZoom"
              type="range"
              min="1"
              max="8"
              step="1"
              aria-label="Word timing zoom"
              class="w-20 accent-hoa-1500"
              :disabled="!!dragState || !!dragStartPos"
            />
          </label>
          <button
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1"
            :title="playLineTitle"
            :disabled="!isWordSyncAvailable || !!wordTextEdit"
            @click="handlePlayLine"
          >
            <Play class="w-3.5 h-3.5" />
            <span>Play</span>
          </button>
          <button
            class="button button-primary text-xs px-2 py-1 rounded flex items-center gap-1"
            :title="syncWordTitle"
            :disabled="!!wordTextEdit"
            @click="handleSyncWord"
          >
            <Equal class="w-3.5 h-3.5" />
            <span>Sync word</span>
          </button>
          <button
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1"
            title="Reset word timings to default state"
            :disabled="!!wordTextEdit"
            @click="handleResetWords"
          >
            <Close class="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <form
        v-if="wordTextEdit"
        class="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs"
        @submit.prevent="applyWordTextEdit"
        @keydown.esc.prevent.stop="cancelWordTextEdit"
      >
        <label for="word-text-edit-input" class="shrink-0">Edit word</label>
        <input
          id="word-text-edit-input"
          ref="wordTextInput"
          v-model="wordText"
          class="input min-w-0 w-48 max-w-full rounded px-2 py-1 text-sm"
          type="text"
          autocomplete="off"
          :aria-invalid="!canApplyWordText"
        />
        <button type="submit" class="button rounded bg-hoa-1500 p-1.5 text-white hover:bg-hoa-1400 dark:bg-hoa-1500 dark:text-white dark:hover:bg-hoa-1400 disabled:opacity-40" title="Apply word edit (Enter)" aria-label="Apply word edit" :disabled="!canApplyWordText"><Check class="h-4 w-4" /></button>
        <button type="button" class="button button-normal rounded p-1.5" title="Cancel word edit (Escape)" aria-label="Cancel word edit" @click="cancelWordTextEdit"><Close class="h-4 w-4" /></button>
      </form>

      <!-- Timeline with word segments -->
      <div
        ref="scrollElement"
        class="h-[76px] min-w-0 overflow-x-auto overflow-y-hidden pt-6 pb-2"
        data-testid="word-timing-scroll"
        @wheel="inspectTimeline"
        @pointerdown="inspectTimeline"
      >
        <div
          ref="timelineElement"
          class="relative h-8 bg-white dark:bg-neutral-900 rounded border border-neutral-300 dark:border-neutral-600"
          :style="{ width: `${timelineZoom * 100}%` }"
          data-testid="word-timing-timeline"
          @click="handleTimelineClick"
        >
          <!-- Timeline grid lines (every 500ms) -->
          <!-- <div class="absolute inset-0 pointer-events-none">
          <template v-for="n in gridLinesCount" :key="n">
            <div
              class="absolute top-0 bottom-0 w-px bg-neutral-200 dark:bg-hoa-1100 opacity-50"
              :style="{ left: `${(n / gridLinesCount) * 100}%` }"
            />
          </template>
        </div> -->

          <!-- Word segments -->
          <SyncedWordTimingSegment
            v-for="(word, index) in displayedWords"
            :key="index"
            :word="word"
            :word-index="index"
            :start-ms="word.start_ms"
            :end-ms="getWordEndMs(index)"
            :line-start-ms="laneStartMs"
            :line-end-ms="laneEndMs"
            :timeline-width="timelineWidth"
            :progress-ms="progressMs"
            :selected="selectedWordIndex === index"
            :editing="!!wordTextEdit"
            @split-at="handleSegmentSplitAt"
            @select-word="selectedWordIndex = $event"
            @edit-word="startWordTextEdit"
          />

          <button
            v-for="index in boundaryIndexes"
            :key="`boundary-${index}`"
            type="button"
            class="group absolute top-0 bottom-0 z-30 -ml-2 w-4 cursor-ew-resize bg-transparent"
            :style="{ left: `${timeToPercent(displayedWords[index].start_ms)}%` }"
            :title="`Adjust start of ${displayedWords[index].text}`"
            @pointerdown="handleBoundaryPointerDown(index, $event)"
            @click="selectBoundary(index, $event)"
          >
            <span
              class="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 transition-all duration-150 ease-linear bg-neutral-300/70 dark:bg-hoa-1000/70 group-hover:bg-neutral-600 dark:group-hover:bg-neutral-300 group-hover:w-[3px] group-hover:ring-1 group-hover:ring-neutral-500/25"
              :class="getBoundaryLineClass(index)"
            />
          </button>

          <div
            v-if="dragState"
            class="absolute inset-y-0 z-20 pointer-events-none"
            :style="{ left: `${timeToPercent(dragState.currentStartMs)}%` }"
          >
            <div
              class="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 bg-neutral-600 dark:bg-neutral-300 ring-1 ring-neutral-500/25"
            />
            <div
              class="absolute top-[-0.375rem] left-0 -translate-x-1/2 -translate-y-full px-[0.4rem] py-0.5 rounded-full text-xs leading-4 whitespace-nowrap text-neutral-800 bg-neutral-200 dark:text-white dark:bg-hoa-1100"
            >
              {{ formatTimestampMs(dragState.currentStartMs) }}
            </div>
          </div>

          <!-- Current playhead indicator -->
          <div
            v-if="progressMs >= lineStartMs && progressMs <= laneEndMs"
            class="absolute -top-1 bottom-0 w-px bg-neutral-400 dark:bg-neutral-400 z-20 pointer-events-none"
            :style="{ left: `${playheadPercent}%` }"
            data-testid="word-timing-playhead"
          >
            <div
              class="absolute -top-1 -left-[3px] w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-neutral-400 dark:border-t-neutral-400"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import Equal from '~icons/mdi/equal'
import Play from '~icons/mdi/play'
import Close from '~icons/mdi/close'
import Magnify from '~icons/mdi/magnify-plus-outline'
import Pencil from '~icons/mdi/pencil-outline'
import Check from '~icons/mdi/check'
import { scrollToTimelineTime } from '@/utils/word-timing-viewport.js'
import SyncedWordTimingSegment from '@/components/library/edit-lyrics-v2/SyncedWordTimingSegment.vue'
import { useEditLyricsV2WordBoundaryDrag } from '@/composables/edit-lyrics-v2/useEditLyricsV2WordBoundaryDrag.js'
import { useEditLyricsV2WordTimingHotkeys } from '@/composables/edit-lyrics-v2/useEditLyricsV2WordTimingHotkeys.js'
import {
  syncedEditorShortcutBindings,
  wordTimingShortcutBindings,
  withShortcutTitle,
} from '@/composables/edit-lyrics-v2/shortcutRegistry.js'
import { formatTimestampMs } from '@/utils/lyricsfile.js'
import { ensureLineWords, distributeWordTimings, hasValidWords } from '@/utils/word-tokenizer.js'

const props = defineProps({
  playing: { type: Boolean, default: false },
  selectedLine: {
    type: Object,
    default: null,
  },
  hasSelectedLine: {
    type: Boolean,
    default: false,
  },
  progressMs: {
    type: Number,
    default: 0,
  },
  allLines: {
    type: Array,
    default: () => [],
  },
  selectedLineIndex: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits(['update:words', 'word-timing-edited', 'play-line', 'select-next-line', 'editing-change', 'word-text-editing-start', 'edit-word-text'])

const timelineElement = ref(null)
const scrollElement = ref(null)
const timelineZoom = ref(2)
const manualInspection = ref(false)
let timelineObserver
let disposed = false
const timelineWidth = ref(0)
const laneStartMs = ref(0)
const laneEndMs = ref(0)
const segmentedTokenTexts = ref(null)
const segmentationRequestId = ref(0)
const selectedWordIndex = ref(0)
const wordTextEdit = shallowRef(null)
const wordText = ref('')
const wordTextInput = ref(null)
const canApplyWordText = computed(() => wordText.value.length > 0 && !/\s/u.test(wordText.value))

const playLineTitle = withShortcutTitle(
  'Play line and continue; stop looping and follow lyrics',
  syncedEditorShortcutBindings,
  'replaySelectedLine'
)

const syncWordTitle = withShortcutTitle(
  'Sync selected word boundary to playback; moving the first word also updates the sentence start marker',
  wordTimingShortcutBindings,
  'syncSelectedSeparatorAndAdvance'
)

// Availability checks for word sync feature
const hasLineContent = computed(() => {
  return props.selectedLine && props.selectedLine.text && props.selectedLine.text.trim().length > 0
})

const hasLineStartTime = computed(() => {
  return props.selectedLine && Number.isFinite(props.selectedLine.start_ms)
})

const hasLineEndTime = computed(() => {
  return props.selectedLine && Number.isFinite(props.selectedLine.end_ms)
})

const isWordSyncAvailable = computed(() => {
  return hasLineContent.value && hasLineStartTime.value && hasLineEndTime.value
})

// Check if the line has actual saved words (not auto-generated)
const hasActualWords = computed(() => {
  return hasValidWords(props.selectedLine)
})

const actualLineEndMs = computed(() => {
  if (!props.selectedLine) return 0

  // Use the line's own end_ms if available
  if (Number.isFinite(props.selectedLine.end_ms)) {
    return props.selectedLine.end_ms
  }

  // Fallback: start_ms + 2000ms
  if (Number.isFinite(props.selectedLine.start_ms)) {
    return props.selectedLine.start_ms + 2000
  }

  return 2000
})

const lineStartMs = computed(() => {
  return Number.isFinite(props.selectedLine?.start_ms) ? props.selectedLine.start_ms : 0
})

const syncLaneWindowToSelection = () => {
  if (!props.hasSelectedLine || !props.selectedLine) {
    laneStartMs.value = 0
    laneEndMs.value = 0
    return
  }

  laneStartMs.value = lineStartMs.value
  laneEndMs.value = actualLineEndMs.value
}

const words = computed(() => {
  if (!isWordSyncAvailable.value) return []

  if (!hasActualWords.value) {
    const lineText = props.selectedLine?.text || ''
    const charabiaTokens = segmentedTokenTexts.value

    if (
      Array.isArray(charabiaTokens) &&
      charabiaTokens.length > 0 &&
      charabiaTokens.join('') === lineText
    ) {
      return distributeWordTimings(
        charabiaTokens.map(text => ({ text })),
        lineStartMs.value,
        actualLineEndMs.value
      )
    }
  }

  const lineWithWords = ensureLineWords(props.selectedLine, props.allLines, props.selectedLineIndex)

  return lineWithWords.words || []
})

const {
  dragState,
  dragStartPos,
  displayedWords,
  boundaryIndexes,
  selectedBoundaryIndex,
  startBoundaryDrag,
  selectBoundary,
  isBoundarySelected,
  selectPreviousBoundary,
  selectNextBoundary,
  syncSelectedBoundary,
  deleteSelectedBoundaries,
  resetBoundarySelection,
  cancelBoundaryInteraction,
} = useEditLyricsV2WordBoundaryDrag({
  isWordSyncAvailable,
  words,
  lineStartMs,
  timelineStartMs: laneStartMs,
  timelineEndMs: laneEndMs,
  selectedLineIndex: computed(() => props.selectedLineIndex),
  onUpdateWords: payload => emit('update:words', payload),
  onWordTimingEdited: payload => emit('word-timing-edited', payload),
})

watch(
  () => Boolean(dragState.value || dragStartPos.value || wordTextEdit.value),
  editing => emit('editing-change', editing),
  { flush: 'sync' }
)

const cancelWordTextEdit = () => {
  wordTextEdit.value = null
  wordText.value = ''
}

const startWordTextEdit = async index => {
  if (!isWordSyncAvailable.value || dragState.value || dragStartPos.value || !Number.isInteger(index) || !words.value[index]) return
  selectedWordIndex.value = index
  wordTextEdit.value = {
    line: props.selectedLine,
    lineIndex: props.selectedLineIndex,
    lineText: props.selectedLine.text,
    wordIndex: index,
    words: words.value,
    snapshot: words.value.map(word => ({ ...word })),
  }
  wordText.value = words.value[index].text.trim()
  emit('word-text-editing-start')
  await nextTick()
  if (!wordTextEdit.value) return
  wordTextInput.value?.focus()
  wordTextInput.value?.select()
}

const applyWordTextEdit = () => {
  const edit = wordTextEdit.value
  if (!edit || !canApplyWordText.value) return
  // Recheck the source at submission as well as watching it during the edit.
  if (edit.line !== props.selectedLine || edit.lineIndex !== props.selectedLineIndex ||
      edit.lineText !== props.selectedLine?.text || edit.words !== words.value ||
      edit.snapshot.length !== words.value.length || edit.snapshot.some((word, index) =>
        word.text !== words.value[index].text || word.start_ms !== words.value[index].start_ms ||
        word.end_ms !== words.value[index].end_ms
      )) {
    cancelWordTextEdit()
    return
  }
  const text = wordText.value
  cancelWordTextEdit()
  emit('edit-word-text', {
    lineIndex: edit.lineIndex,
    line: edit.line,
    wordIndex: edit.wordIndex,
    text,
    words: edit.words,
  })
}

watch(
  [() => props.selectedLine, () => props.selectedLineIndex, () => props.allLines, words],
  () => cancelWordTextEdit(),
  { deep: true, flush: 'sync' }
)

const playheadPercent = computed(() => {
  if (!isWordSyncAvailable.value) return 0

  const duration = laneEndMs.value - laneStartMs.value
  if (duration <= 0) return 0

  const elapsed = props.progressMs - laneStartMs.value
  return Math.max(0, Math.min(100, (elapsed / duration) * 100))
})

const updateTimelineWidth = () => {
  if (timelineElement.value) {
    timelineWidth.value = timelineElement.value.clientWidth
  }
}

const inspectTimeline = event => {
  if (event?.type === 'wheel' && (dragState.value || dragStartPos.value)) event.preventDefault()
  manualInspection.value = true
}
const revealTime = timeMs => {
  const element = scrollElement.value
  if (!element || dragState.value || dragStartPos.value) return
  element.scrollLeft = scrollToTimelineTime({
    timeMs,
    startMs: laneStartMs.value,
    endMs: laneEndMs.value,
    width: timelineWidth.value,
    visibleWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
  })
}

// Only matching live playback follows. Manual inspection stays put until playback resumes
// or a boundary is deliberately selected; never change the mapping during a drag.
watch([() => props.progressMs, () => props.playing], () => {
  if (props.playing && !manualInspection.value) revealTime(props.progressMs)
})
watch(
  () => props.playing,
  () => {
    manualInspection.value = false
  }
)
watch(selectedBoundaryIndex, async index => {
  await nextTick()
  revealTime(displayedWords.value[index]?.start_ms)
})
watch(timelineZoom, async () => {
  await nextTick()
  updateTimelineWidth()
  revealTime(displayedWords.value[selectedBoundaryIndex.value]?.start_ms)
})

const timeToPercent = timeMs => {
  if (!isWordSyncAvailable.value) return 0

  const duration = laneEndMs.value - laneStartMs.value
  if (duration <= 0) return 0

  const elapsed = timeMs - laneStartMs.value
  return Math.max(0, Math.min(100, (elapsed / duration) * 100))
}

const getWordEndMs = index => {
  if (index >= displayedWords.value.length - 1) {
    return laneEndMs.value
  }

  const nextWordStart = displayedWords.value[index + 1]?.start_ms
  return Number.isFinite(nextWordStart) ? nextWordStart : laneEndMs.value
}

const handleBoundaryPointerDown = (rightWordIndex, event) => {
  if (wordTextEdit.value) return
  const rect = timelineElement.value?.getBoundingClientRect()
  if (!rect?.width) return
  const initialTime = words.value[rightWordIndex]?.start_ms
  const initialX = event.clientX
  const duration = laneEndMs.value - laneStartMs.value
  // Freeze geometry and retain the grab offset before the drag threshold is crossed.
  startBoundaryDrag(rightWordIndex, event, clientX =>
    Math.round(initialTime + ((clientX - initialX) / rect.width) * duration)
  )
}

const getBoundaryLineClass = index => {
  const isActive =
    dragState.value?.rightWordIndex === index ||
    (!dragState.value && selectedBoundaryIndex.value === index)
  const isSelected = !dragState.value && isBoundarySelected(index)

  if (isSelected) {
    return 'bg-hoa-1000 dark:bg-neutral-300 w-[3px] ring-2 ring-neutral-300/35'
  }

  if (isActive) {
    return 'bg-neutral-600 dark:bg-neutral-300 w-[3px] ring-1 ring-neutral-500/25'
  }

  return ''
}

const handleSyncWord = () => {
  if (wordTextEdit.value) return
  const selectedBoundaryBeforeSync = selectedBoundaryIndex.value
  const synced = syncSelectedBoundary(props.progressMs)

  if (
    synced &&
    selectedBoundaryBeforeSync === words.value.length - 1 &&
    props.selectedLineIndex < props.allLines.length - 1
  ) {
    emit('select-next-line')
  }
}

const handleSyncWordNoAdvance = () => {
  if (wordTextEdit.value) return
  syncSelectedBoundary(props.progressMs, { advance: false })
}

const handlePlayLine = () => {
  if (!isWordSyncAvailable.value) return
  emit('play-line', props.selectedLineIndex)
}

const splitTextByGrapheme = text => {
  if (!text || typeof text !== 'string') {
    return []
  }

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), item => item.segment)
  }

  return Array.from(text)
}

const getWordEndMsFromList = (wordsList, index) => {
  if (index >= wordsList.length - 1) {
    return laneEndMs.value
  }

  const nextWordStart = wordsList[index + 1]?.start_ms
  return Number.isFinite(nextWordStart) ? nextWordStart : laneEndMs.value
}

const handleDeleteSelectedBoundaries = () => {
  if (wordTextEdit.value) return
  if (!isWordSyncAvailable.value) return
  deleteSelectedBoundaries()
}

const handleSegmentSplitAt = ({ wordIndex, splitIndex, splitRatio }) => {
  if (wordTextEdit.value) return
  if (!isWordSyncAvailable.value) {
    return
  }

  if (!Number.isInteger(wordIndex) || wordIndex < 0 || wordIndex >= displayedWords.value.length) {
    return
  }

  const currentWord = displayedWords.value[wordIndex]
  const graphemes = splitTextByGrapheme(currentWord?.text || '')
  if (graphemes.length <= 1) {
    return
  }

  const fallbackSplitIndex = Math.max(
    1,
    Math.min(graphemes.length - 1, Math.floor(graphemes.length / 2))
  )
  const normalizedSplitIndex = Number.isInteger(splitIndex)
    ? Math.max(1, Math.min(graphemes.length - 1, splitIndex))
    : fallbackSplitIndex

  const leftText = graphemes.slice(0, normalizedSplitIndex).join('')
  const rightText = graphemes.slice(normalizedSplitIndex).join('')

  const wordStartMs = Number.isFinite(currentWord?.start_ms)
    ? currentWord.start_ms
    : laneStartMs.value
  const wordEndMs = getWordEndMsFromList(displayedWords.value, wordIndex)
  const normalizedSplitRatio = Number.isFinite(splitRatio)
    ? Math.max(0, Math.min(1, splitRatio))
    : normalizedSplitIndex / graphemes.length
  const splitTimeMs = Math.max(
    wordStartMs + 1,
    Math.min(
      wordEndMs - 1,
      Math.round(wordStartMs + (wordEndMs - wordStartMs) * normalizedSplitRatio)
    )
  )

  const updatedWords = [
    ...displayedWords.value.slice(0, wordIndex),
    { text: leftText, start_ms: wordStartMs },
    { text: rightText, start_ms: splitTimeMs },
    ...displayedWords.value.slice(wordIndex + 1),
  ]

  emit('update:words', {
    lineIndex: props.selectedLineIndex,
    words: updatedWords,
    lineStartMs: laneStartMs.value,
  })

  selectBoundary(Math.min(updatedWords.length - 1, wordIndex + 1))
}

const loadDefaultSegmentation = async ({ force = false } = {}) => {
  if (disposed) return
  const requestId = ++segmentationRequestId.value
  if (!isWordSyncAvailable.value) {
    segmentedTokenTexts.value = null
    return
  }

  if (!force && hasActualWords.value) {
    segmentedTokenTexts.value = null
    return
  }

  const lineText = props.selectedLine?.text || ''
  if (!lineText) {
    segmentedTokenTexts.value = []
    return
  }

  try {
    const tokens = await invoke('segment_words', { text: lineText })

    if (requestId !== segmentationRequestId.value) {
      return
    }

    if (!Array.isArray(tokens)) {
      segmentedTokenTexts.value = null
      return
    }

    segmentedTokenTexts.value = tokens
      .filter(token => typeof token === 'string')
      .filter(token => token.length > 0)
  } catch (error) {
    if (requestId !== segmentationRequestId.value) {
      return
    }

    segmentedTokenTexts.value = null
    console.error(error)
  }
}

const { bindWordTimingHotkeys, unbindWordTimingHotkeys } = useEditLyricsV2WordTimingHotkeys({
  isWordSyncAvailable,
  selectedBoundaryIndex,
  words,
  syncSelectedBoundaryAtProgress: () => handleSyncWord(),
  syncSelectedBoundaryAtProgressNoAdvance: () => handleSyncWordNoAdvance(),
  selectPreviousBoundary: () => selectPreviousBoundary(),
  selectNextBoundary: () => selectNextBoundary(),
  resetBoundarySelection: () => resetBoundarySelection(),
  deleteSelectedBoundaries: () => handleDeleteSelectedBoundaries(),
})

watch(
  () => props.selectedLineIndex,
  (newIndex, oldIndex) => {
    cancelBoundaryInteraction()
    // Only reset boundary index when actually changing to a different line
    if (newIndex !== oldIndex) {
      selectedWordIndex.value = 0
      manualInspection.value = false
      if (scrollElement.value) scrollElement.value.scrollLeft = 0
      resetBoundarySelection()
      syncLaneWindowToSelection()
    } else if (!props.hasSelectedLine) {
      syncLaneWindowToSelection()
    }

    segmentedTokenTexts.value = null
    void loadDefaultSegmentation()

    nextTick(() => {
      updateTimelineWidth()
    })
  },
  { immediate: true }
)

const handleResetWords = async () => {
  if (wordTextEdit.value) return
  if (!isWordSyncAvailable.value) return

  // Clear the words object entirely - this removes persisted word timings.
  emit('update:words', {
    lineIndex: props.selectedLineIndex,
    words: undefined,
  })

  // Reset selected boundary after clearing.
  resetBoundarySelection()

  // Wait for parent state to apply, then force segmentation so first reset is reliable.
  await nextTick()
  await loadDefaultSegmentation({ force: true })
}

const handleTimelineClick = event => {
  event.stopPropagation()
}

watch(
  () => props.hasSelectedLine,
  hasLine => {
    if (hasLine) {
      nextTick(() => {
        updateTimelineWidth()
      })
      return
    }

    syncLaneWindowToSelection()
  },
  { immediate: true }
)

watch(isWordSyncAvailable, (available, wasAvailable) => {
  if (!available) {
    cancelBoundaryInteraction()
    segmentedTokenTexts.value = null
    return
  }

  if (!wasAvailable) {
    syncLaneWindowToSelection()
    segmentedTokenTexts.value = null
    void loadDefaultSegmentation()
  }
})

watch(hasActualWords, (hasWords, hadWords) => {
  if (hadWords && !hasWords && isWordSyncAvailable.value) {
    segmentedTokenTexts.value = null
    void loadDefaultSegmentation()
  }
})

watch(
  () => props.selectedLine?.text,
  () => {
    segmentedTokenTexts.value = null
    if (isWordSyncAvailable.value) {
      void loadDefaultSegmentation()
    }
  }
)

watch(
  [lineStartMs, actualLineEndMs],
  () => {
    if (!props.hasSelectedLine || !props.selectedLine) {
      return
    }

    laneStartMs.value = lineStartMs.value
    laneEndMs.value = actualLineEndMs.value
  },
  { immediate: true }
)

watch(
  () => props.allLines,
  () => {
    if (dragState.value || dragStartPos.value) {
      cancelBoundaryInteraction()
    }
  },
  { deep: true, flush: 'sync' }
)

watch(
  words,
  () => {
    if (dragState.value || dragStartPos.value) cancelBoundaryInteraction()
  },
  { flush: 'sync' }
)

onMounted(() => {
  timelineObserver = new ResizeObserver(updateTimelineWidth)
  if (timelineElement.value) timelineObserver.observe(timelineElement.value)
  updateTimelineWidth()
  revealTime(displayedWords.value[selectedBoundaryIndex.value]?.start_ms)
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('blur', cancelBoundaryInteraction)
  bindWordTimingHotkeys()
})

onUnmounted(() => {
  emit('editing-change', false)
  disposed = true
  segmentationRequestId.value++
  timelineObserver?.disconnect()
  cancelBoundaryInteraction()
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('blur', cancelBoundaryInteraction)
  unbindWordTimingHotkeys()
})

watch(
  timelineElement,
  element => {
    timelineObserver?.disconnect()
    if (element) timelineObserver?.observe(element)
    updateTimelineWidth()
  },
  { flush: 'post' }
)
</script>

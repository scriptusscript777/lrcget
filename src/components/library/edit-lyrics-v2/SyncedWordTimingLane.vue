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
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-tooltip="
              editorTooltip(
                'Repeat the selected word; click another word to move the loop. Lead-in and Tail add listening context only.'
              )
            "
            type="button"
            class="button text-xs px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
            :class="wordLoopEnabled ? 'button-primary' : 'button-normal'"
            :aria-pressed="wordLoopEnabled"
            aria-label="Loop selected word"
            :disabled="!wordLoopEnabled && !selectedWordLoopRange"
            @click="emit('toggle-word-loop')"
          >
            <Repeat class="w-3.5 h-3.5" />Loop word
          </button>
          <button
            v-tooltip="
              editorTooltip(
                'Repeat the selected sentence and its waveform markers; switching from Word loop selects Sentence loop'
              )
            "
            type="button"
            class="button text-xs px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
            :class="sentenceLoopEnabled ? 'button-primary' : 'button-normal'"
            :aria-pressed="sentenceLoopEnabled"
            aria-label="Loop selected sentence"
            :disabled="!sentenceLoopEnabled && !canSentenceLoop"
            @click="emit('toggle-sentence-loop')"
          >
            <Repeat class="w-3.5 h-3.5" />Loop sentence
          </button>
          <label class="inline-flex items-center gap-1" title="Word timing zoom">
            <span class="sr-only">Word timing zoom</span>
            <Magnify class="h-3.5 w-3.5" />
            <input
              v-model.number="timelineZoom"
              v-tooltip="editorTooltip('Magnify the word timeline for precise boundary editing')"
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
            v-tooltip="editorTooltip(playLineTitle)"
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1"
            :title="playLineTitle"
            :disabled="!isWordSyncAvailable"
            @click="handlePlayLine"
          >
            <Play class="w-3.5 h-3.5" />
            <span>Play</span>
          </button>
          <button
            v-tooltip="
              editorTooltip(
                playing
                  ? 'Pause playback at its current position; keep Loop enabled'
                  : 'Resume playback from its current position; keep Loop enabled'
              )
            "
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1"
            :aria-label="playing ? 'Pause word timing playback' : 'Resume word timing playback'"
            :disabled="!!dragState || !!dragStartPos"
            @click="emit(playing ? 'pause' : 'resume-playback')"
          >
            <Pause v-if="playing" class="w-3.5 h-3.5" />
            <Play v-else class="w-3.5 h-3.5" />
            <span>{{ playing ? 'Pause' : 'Resume' }}</span>
          </button>
          <button
            v-tooltip="editorTooltip(syncWordHelp)"
            class="button text-xs px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isManualTimingConfirmed ? 'button-normal' : 'button-primary'"
            :title="syncWordHelp"
            :disabled="isManualTimingConfirmed || !!dragState || !!dragStartPos"
            @click="handleSyncWord"
          >
            <Equal class="w-3.5 h-3.5" />
            <span>Sync word</span>
          </button>
          <button
            v-tooltip="
              editorTooltip(
                'Reset word timing to evenly spaced editable boundaries; keep lyric text'
              )
            "
            class="button button-normal text-xs px-2 py-1 rounded flex items-center gap-1"
            title="Reset only this sentence’s word timing; keep its text and sentence markers. Undo restores the previous timing."
            :disabled="!!dragState || !!dragStartPos"
            @click="handleResetWords"
          >
            <Close class="w-3.5 h-3.5" />
            <span>Reset words</span>
          </button>
        </div>
      </div>

      <div
        v-if="selectedWordLoopRange"
        class="mt-2 flex flex-wrap items-center gap-2 text-xs"
        data-testid="selected-word-controls"
      >
        <span class="max-w-40 truncate font-semibold" :title="words[selectedWordIndex]?.text">{{
          words[selectedWordIndex]?.text.trim()
        }}</span>
        <label class="inline-flex items-center gap-1"
          >Start
          <input
            :key="`start-${selectedWordLoopRange.startMs}`"
            class="input w-24 rounded px-1 py-1 font-mono"
            type="number"
            min="0"
            :step="timingStepMs / 1000"
            :value="(selectedWordLoopRange.startMs / 1000).toFixed(3)"
            aria-label="Selected word start seconds"
            :disabled="!!dragState || !!dragStartPos"
            @change="editSelectedBoundary('start', $event)"
          />s
        </label>
        <label class="inline-flex items-center gap-1"
          >End
          <input
            :key="`end-${selectedWordLoopRange.endMs}`"
            class="input w-24 rounded px-1 py-1 font-mono"
            type="number"
            min="0"
            :step="timingStepMs / 1000"
            :value="(selectedWordLoopRange.endMs / 1000).toFixed(3)"
            aria-label="Selected word end seconds"
            :disabled="!!dragState || !!dragStartPos"
            @change="editSelectedBoundary('end', $event)"
          />s
        </label>
        <span v-if="!hasActualWords" class="text-neutral-600 dark:text-neutral-400"
          >Estimated timing; edit a word or accept estimates when saving ELRC.</span
        >
      </div>
      <p v-if="wordLoopEnabled && !selectedWordLoopRange" role="status" class="mt-1 text-xs">
        Word loop is on; select a word with valid timing to repeat.
      </p>

      <p
        v-if="timingMessage"
        role="status"
        class="mt-2 rounded bg-neutral-900 px-2 py-1 text-xs text-yellow-300 dark:bg-amber-950 dark:text-yellow-300"
      >
        {{ timingMessage }}
      </p>

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
            @select-word="selectWord"
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
    <div
      v-if="wordLoopEnabled && !isWordSyncAvailable"
      class="mt-2 flex items-center gap-2 text-xs"
      role="status"
    >
      Word loop is on; select a timed sentence to resume.
      <button
        type="button"
        class="button button-normal rounded px-2 py-1"
        @click="emit('toggle-word-loop')"
      >
        Stop word loop
      </button>
    </div>
  </div>
</template>

<script setup>
import { vTooltip, editorTooltip } from '@/utils/editor-tooltip.js'
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import Repeat from '~icons/mdi/repeat'
import { selectedWordRange, editWordBoundary } from '@/utils/word-loop-range.js'
import Equal from '~icons/mdi/equal'
import Play from '~icons/mdi/play'
import Pause from '~icons/mdi/pause'
import Close from '~icons/mdi/close'
import Magnify from '~icons/mdi/magnify-plus-outline'
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
  followLyrics: { type: Boolean, default: true },
  wordLoopEnabled: { type: Boolean, default: false },
  sentenceLoopEnabled: { type: Boolean, default: false },
  canSentenceLoop: { type: Boolean, default: false },
  initialWordIndex: { type: Number, default: 0 },
  timingStepMs: { type: Number, default: 10 },
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

const emit = defineEmits([
  'update:words',
  'word-timing-edited',
  'play-line',
  'pause',
  'resume-playback',
  'select-next-line',
  'editing-change',
  'word-loop-target',
  'toggle-word-loop',
  'toggle-sentence-loop',
])

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
const selectedWordIndex = ref(
  Number.isInteger(props.initialWordIndex) && props.initialWordIndex >= 0
    ? props.initialWordIndex
    : 0
)
const timingMessage = ref('')

const playLineTitle = withShortcutTitle(
  'Play line; keep Loop on when enabled, otherwise continue forward',
  syncedEditorShortcutBindings,
  'replaySelectedLine'
)

const syncWordTitle = withShortcutTitle(
  'Keep a manually adjusted divider; otherwise sync the selected word start to playback within its neighbors. Sentence markers stay fixed.',
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
  clearManualTiming,
  hasAdjustedBoundary,
  isManualTimingConfirmed,
  rememberAdjustedBoundary,
  consumeOwnWordUpdate,
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
  onWordTimingEdited: payload => {
    timingMessage.value = ''
    emit('word-timing-edited', payload)
  },
  onTimingError: message => {
    timingMessage.value = message
  },
})

const syncWordHelp = computed(() =>
  isManualTimingConfirmed.value
    ? 'Word timing is set. Adjust a divider or Start/End to enable Sync word again.'
    : syncWordTitle
)

watch(
  () => Boolean(dragState.value || dragStartPos.value),
  editing => emit('editing-change', editing),
  { flush: 'sync' }
)

const selectedWordLoopRange = computed(() =>
  selectedWordRange(words.value, selectedWordIndex.value, actualLineEndMs.value)
)
watch(
  [
    selectedWordLoopRange,
    () => props.selectedLine,
    () => props.selectedLineIndex,
    selectedWordIndex,
  ],
  () => {
    const range = selectedWordLoopRange.value
    emit(
      'word-loop-target',
      range
        ? {
            ...range,
            line: props.selectedLine,
            lineIndex: props.selectedLineIndex,
            wordIndex: selectedWordIndex.value,
          }
        : null
    )
  },
  { immediate: true }
)

const editSelectedBoundary = (boundary, event) => {
  if (dragState.value || dragStartPos.value) return
  timingMessage.value = ''
  const timeMs = event.target.value.trim() === '' ? NaN : Number(event.target.value) * 1000
  const updatedWords = editWordBoundary(
    words.value,
    selectedWordIndex.value,
    boundary,
    timeMs,
    lineStartMs.value,
    actualLineEndMs.value
  )
  if (updatedWords)
    emit('update:words', {
      lineIndex: props.selectedLineIndex,
      words: updatedWords,
      lineStartMs: undefined,
      onResult: accepted => {
        if (accepted)
          rememberAdjustedBoundary(selectedWordIndex.value, updatedWords, {
            includePrevious: boundary === 'start',
          })
        else
          timingMessage.value =
            'Word timing was not applied; its sentence or overlap bounds changed.'
      },
    })
  else
    timingMessage.value =
      'Word timing was not changed: keep its start before its end and inside its neighboring words.'
  // Reflect the actual accepted/clamped document after parent validation.
  nextTick(() => {
    const range = selectedWordLoopRange.value
    if (range)
      event.target.value = ((boundary === 'start' ? range.startMs : range.endMs) / 1000).toFixed(3)
  })
}

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
watch([() => props.progressMs, () => props.playing, () => props.followLyrics], () => {
  if (props.followLyrics && props.playing && !manualInspection.value) revealTime(props.progressMs)
})
watch(
  () => props.playing,
  () => {
    manualInspection.value = false
  }
)
watch(selectedBoundaryIndex, async index => {
  selectedWordIndex.value = index
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

const getWordEndMs = index =>
  selectedWordRange(displayedWords.value, index, laneEndMs.value)?.endMs ?? laneEndMs.value

const selectWord = index => {
  if (!Number.isInteger(index) || !words.value[index] || dragState.value || dragStartPos.value)
    return
  selectedWordIndex.value = index
  selectBoundary(index)
}

watch(words, current => {
  if (selectedWordIndex.value >= current.length)
    selectedWordIndex.value = Math.max(0, current.length - 1)
})

const handleBoundaryPointerDown = (rightWordIndex, event) => {
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
  timingMessage.value = ''
  const keptDrag = hasAdjustedBoundary.value
  const selectedBoundaryBeforeSync = selectedBoundaryIndex.value
  const synced = syncSelectedBoundary(props.progressMs, { advance: !props.wordLoopEnabled })

  if (
    synced &&
    !props.wordLoopEnabled &&
    !keptDrag &&
    selectedBoundaryBeforeSync === words.value.length - 1 &&
    props.selectedLineIndex < props.allLines.length - 1
  ) {
    emit('select-next-line')
  }
}

const handleSyncWordNoAdvance = () => {
  timingMessage.value = ''
  syncSelectedBoundary(props.progressMs, { advance: false })
}

const handlePlayLine = () => {
  if (!isWordSyncAvailable.value) return
  emit('play-line', props.selectedLineIndex)
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

    if (
      disposed ||
      requestId !== segmentationRequestId.value ||
      props.selectedLine?.text !== lineText ||
      hasActualWords.value
    ) {
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
    if (
      disposed ||
      requestId !== segmentationRequestId.value ||
      props.selectedLine?.text !== lineText ||
      hasActualWords.value
    ) {
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
})

watch(
  () => props.selectedLineIndex,
  (newIndex, oldIndex) => {
    cancelBoundaryInteraction()
    // Only reset boundary index when actually changing to a different line
    if (newIndex !== oldIndex) {
      const preferred = Number.isInteger(props.initialWordIndex) ? props.initialWordIndex : 0
      selectedWordIndex.value = Math.max(0, Math.min(preferred, words.value.length - 1))
      manualInspection.value = false
      if (scrollElement.value) scrollElement.value.scrollLeft = 0
      resetBoundarySelection()
      selectBoundary(selectedWordIndex.value)
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
  if (dragState.value || dragStartPos.value || !isWordSyncAvailable.value) return

  // Clear only this sentence's working word timing after document validation.
  let accepted = false
  const lineIndex = props.selectedLineIndex
  emit('update:words', {
    lineIndex,
    words: [],
    onResult: result => {
      accepted = result === true
    },
  })
  if (!accepted) {
    timingMessage.value = 'Word timing was not reset; its sentence or overlap bounds changed.'
    return
  }
  timingMessage.value = ''

  // Reset selected boundary and confirmation after clearing.
  clearManualTiming()
  resetBoundarySelection()

  // Wait for parent state to apply, then force segmentation so first reset is reliable.
  await nextTick()
  if (disposed || props.selectedLineIndex !== lineIndex) return
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
    if (dragState.value || dragStartPos.value) cancelBoundaryInteraction()
    if (!props.hasSelectedLine || !props.selectedLine) {
      return
    }

    laneStartMs.value = lineStartMs.value
    laneEndMs.value = actualLineEndMs.value
  },
  { immediate: true }
)

watch(
  words,
  current => {
    if (consumeOwnWordUpdate(current)) return
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

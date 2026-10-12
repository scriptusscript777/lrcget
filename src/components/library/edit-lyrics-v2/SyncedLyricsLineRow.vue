<template>
  <div
    ref="rowElement"
    class="group flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors h-9 select-none"
    :class="rowClass"
    @mouseenter="emit('mouseenter', index)"
    @mouseleave="emit('mouseleave')"
    @click="emit('select', index)"
    @mousedown="handleMouseDown"
  >
    <div class="flex items-center gap-1 w-[3.5rem]">
      <button
        v-tooltip="editorTooltip('Play from this sentence; keep Loop on when enabled, otherwise continue forward')"
        class="button p-1 rounded-full text-sm h-6 w-6"
        :class="Number.isFinite(line.start_ms) && line.start_ms >= 0 ? 'button-normal' : 'button-disabled'"
        :disabled="!Number.isFinite(line.start_ms) || line.start_ms < 0"
        :title="Number.isFinite(line.start_ms) && line.start_ms >= 0 ? 'Play line; keep Loop on when enabled, otherwise continue forward' : 'Set a sentence start timestamp before playing this line'"
        :aria-label="`Play lyric ${index + 1}`"
        @click.stop="emit('play-line', index)"
      >
        <Play />
      </button>
      <button
        v-show="isLineControlsVisible || previewRange?.startChanged"
        v-tooltip="editorTooltip(syncLineTitle)"
        class="button p-1 rounded-full text-sm h-6 w-6"
        :class="previewRange?.startChanged ? pendingMarkerButtonClass : 'button-primary'"
        data-testid="sentence-sync-start"
        :title="syncLineTitle"
        :aria-label="syncLineTitle"
        @click.stop="emit('sync-line', index)"
      >
        <Equal />
      </button>
    </div>

    <div class="relative flex-none">
      <button
        v-show="isLineControlsVisible && line.start_ms"
        v-tooltip="editorTooltip(rewindLineTitle)"
        class="button p-0.5 rounded-full text-xs h-5 w-5 bg-hoa-100 dark:bg-hoa-1500 text-hoa-800/70 dark:text-hoa-200/70 absolute -left-1.5 top-1/2 -translate-y-1/2 z-10"
        :title="rewindLineTitle"
        :aria-label="rewindLineTitle"
        @click.stop="emit('rewind-line', index)"
      >
        <Rewind />
      </button>
      <div
        class="px-3 py-0.5 text-xs font-mono rounded-full bg-hoa-100 dark:bg-hoa-1500 text-hoa-1300 dark:text-hoa-200 min-w-[5.75rem] text-center"
        :class="{ 'font-bold': isLinePlaying }"
      >
        {{ timestampText }}
      </div>
      <button
        v-show="isLineControlsVisible && line.start_ms"
        v-tooltip="editorTooltip(forwardLineTitle)"
        class="button p-0.5 rounded-full text-xs h-5 w-5 bg-hoa-100 dark:bg-hoa-1500 text-hoa-800/70 dark:text-hoa-200/70 absolute -right-1.5 top-1/2 -translate-y-1/2 z-10"
        :title="forwardLineTitle"
        :aria-label="forwardLineTitle"
        @click.stop="emit('forward-line', index)"
      >
        <Forward />
      </button>
    </div>

    <input
      v-if="isEditing"
      :ref="setLineInputRef"
      v-model="editingTextProxy"
      class="grow h-full px-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 outline-none"
      :class="{ 'font-bold': isLinePlaying }"
      @blur="emit('save-edit')"
      @keydown.enter.prevent="emit('save-edit')"
      @keydown.esc.prevent="emit('cancel-edit')"
    />

    <div
      v-else
      class="grow min-h-7 flex items-center px-2 rounded-md cursor-text"
      :class="isLinePlaying ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'"
      @click="emit('select', index)"
      @dblclick="emit('start-edit', index)"
    >
      <span
        class="mr-2 shrink-0 inline-block w-2 h-2 rounded-full border"
        :class="
          hasWordSync
            ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-400 dark:border-emerald-400'
            : 'bg-neutral-300 border-neutral-400 dark:bg-neutral-600 dark:border-neutral-500'
        "
        :title="hasWordSync ? 'Word timing present; it may include accepted estimates. Green does not mean manually verified. Review by listening; Save/export writes timing to a file.' : 'No saved word timing yet; displayed highlights may use estimates.'"
        :aria-label="hasWordSync ? 'Word synced' : 'Word not synced'"
      />

      <template v-if="hasWordSync">
        <span
          v-for="(word, wordIndex) in line.words"
          :key="wordIndex"
          class="whitespace-pre-wrap"
          :class="{
            'text-yellow-600 dark:text-yellow-300 font-bold': wordIndex === currentWordIndex,
          }"
        >
          {{ word.text }}
        </span>
      </template>
      <template v-else>
        {{ line.text || ' ' }}
      </template>
    </div>

    <div class="flex-none flex gap-3">
      <div class="relative flex items-center">
        <button
          v-show="isLineControlsVisible && line.end_ms"
          v-tooltip="editorTooltip(rewindEndTitle)"
          class="button p-0.5 rounded-full text-xs h-5 w-5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600/70 dark:text-neutral-300/70 absolute -left-1.5 top-1/2 -translate-y-1/2 z-10"
          :title="rewindEndTitle"
          :aria-label="rewindEndTitle"
          @click.stop="emit('rewind-end', index)"
        >
          <Rewind />
        </button>
        <div
          v-show="isLineControlsVisible || hasEndTimestampDiffDirection"
          class="px-3 py-0.5 text-xs font-mono rounded-full min-w-[5.75rem] text-center"
          :class="endTimestampPillClass"
          :title="endTimestampPillTitle"
        >
          {{ endTimestampText }}
        </div>
        <button
          v-show="isLineControlsVisible && line.end_ms"
          v-tooltip="editorTooltip(forwardEndTitle)"
          class="button p-0.5 rounded-full text-xs h-5 w-5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600/70 dark:text-neutral-300/70 absolute -right-1.5 top-1/2 -translate-y-1/2 z-10"
          :title="forwardEndTitle"
          :aria-label="forwardEndTitle"
          @click.stop="emit('forward-end', index)"
        >
          <Forward />
        </button>
      </div>

      <div class="h-6 w-6 mr-4 shrink-0">
        <button
          v-show="isLineControlsVisible || previewRange?.endChanged"
          v-tooltip="editorTooltip(syncEndTitle)"
          class="button p-1 rounded-full text-sm h-6 w-6"
          :class="previewRange?.endChanged ? pendingMarkerButtonClass : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 hover:dark:bg-neutral-600'"
          data-testid="sentence-sync-end"
          :title="syncEndTitle"
          :aria-label="syncEndTitle"
          @click.stop="emit('sync-end', index)"
        >
          <Equal />
        </button>
      </div>
    </div>

    <div class="flex items-center gap-1 w-[3.5rem] justify-end">
      <button
        v-show="isLineControlsVisible"
        v-tooltip="editorTooltip('Delete this lyric line; Undo restores it')"
        class="button p-1 rounded-full text-sm h-6 w-6 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 hover:dark:bg-neutral-600 text-red-500 dark:text-red-400"
        title="Delete line"
        aria-label="Delete line"
        @click.stop="emit('delete-line', index)"
      >
        <Trash />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { activeWordIndex, isLinePlaybackActive } from '@/utils/word-playback.js'
import { hasMeasuredWordTiming } from '@/utils/word-timing-status.js'
import { vTooltip, editorTooltip } from '@/utils/editor-tooltip.js'
import Play from '~icons/mdi/play'
import Equal from '~icons/mdi/equal'
import Rewind from '~icons/mdi/rewind'
import Forward from '~icons/mdi/fast-forward'
import Trash from '~icons/mdi/trash-can'
import {
  syncedEditorShortcutBindings,
  withShortcutTitle,
} from '@/composables/edit-lyrics-v2/shortcutRegistry.js'

const props = defineProps({
  timingStepMs: { type: Number, default: 100 },
  index: {
    type: Number,
    required: true,
  },
  line: {
    type: Object,
    required: true,
  },
  rowClass: {
    type: String,
    default: 'bg-transparent',
  },
  isLineControlsVisible: {
    type: Boolean,
    default: false,
  },
  endTimestampDiffDirection: {
    type: String,
    default: '',
  },
  isEditing: {
    type: Boolean,
    default: false,
  },
  editingText: {
    type: String,
    default: '',
  },
  timestampText: {
    type: String,
    default: '',
  },
  endTimestampText: {
    type: String,
    default: '',
  },
  setLineInputRef: {
    type: Function,
    required: true,
  },
  previewRange: { type: Object, default: null },
  inferredEndMs: { type: Number, default: null },
  progressMs: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits([
  'mouseenter',
  'mouseleave',
  'select',
  'mousedown-line',
  'play-line',
  'sync-line',
  'rewind-line',
  'forward-line',
  'delete-line',
  'start-edit',
  'save-edit',
  'cancel-edit',
  'update:editing-text',
  'sync-end',
  'rewind-end',
  'forward-end',
])

const pendingMarkerButtonClass = 'bg-amber-200 text-amber-950 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700'

const rowElement = ref(null)

const handleMouseDown = event => {
  // Ignore mousedown on interactive elements (buttons, inputs) so they
  // can handle their own click events without starting a drag selection.
  if (event.target.closest('button, input')) {
    return
  }
  emit('mousedown-line', props.index, event)
}

const playbackOptions = computed(() => ({
  previewRange: props.previewRange,
  inferredEndMs: props.inferredEndMs,
}))
const isLinePlaying = computed(() =>
  isLinePlaybackActive(props.line, props.progressMs, playbackOptions.value)
)

const editingTextProxy = computed({
  get: () => props.editingText,
  set: value => emit('update:editing-text', value),
})

const syncLineTitle = computed(() => withShortcutTitle(
  props.previewRange?.startChanged ? 'Apply previewed start marker; keep confirmed end fixed' : 'Sync sentence start to current playback; keep end fixed',
  syncedEditorShortcutBindings,
  'syncLineToPlayback'
))

const rewindLineTitle = computed(() => withShortcutTitle(`Shift sentence and both markers earlier by ${props.timingStepMs}ms`, syncedEditorShortcutBindings, 'rewindLine'))

const forwardLineTitle = computed(() => withShortcutTitle(
  `Shift sentence and both markers later by ${props.timingStepMs}ms`,
  syncedEditorShortcutBindings,
  'forwardLine'
))

const syncEndTitle = computed(() => withShortcutTitle(
  props.previewRange?.endChanged ? 'Apply previewed end marker; keep confirmed start fixed' : 'Sync sentence end to current playback; keep start fixed',
  syncedEditorShortcutBindings,
  'syncLineEndToPlayback'
))

const rewindEndTitle = computed(() => withShortcutTitle(
  `Move sentence end and end marker earlier by ${props.timingStepMs}ms`,
  syncedEditorShortcutBindings,
  'rewindLineEnd'
))

const forwardEndTitle = computed(() => withShortcutTitle(
  `Move sentence end and end marker later by ${props.timingStepMs}ms`,
  syncedEditorShortcutBindings,
  'forwardLineEnd'
))

const hasEndTimestampDiffDirection = computed(() => {
  return props.endTimestampDiffDirection === 'before' || props.endTimestampDiffDirection === 'after'
})

const endTimestampPillClass = computed(() => ({
  'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300':
    !hasEndTimestampDiffDirection.value,
  'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300':
    props.endTimestampDiffDirection === 'before',
  'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300':
    props.endTimestampDiffDirection === 'after',
  'opacity-50': !props.line?.end_ms,
}))

const endTimestampPillTitle = computed(() => {
  if (props.endTimestampDiffDirection === 'before') {
    return 'End timestamp is before next line start (gap)'
  }

  if (props.endTimestampDiffDirection === 'after') {
    return 'End timestamp is after next line start (overlap)'
  }

  return 'End timestamp'
})

// Check if line has word-by-word synced data
const hasWordSync = computed(() => {
  return hasMeasuredWordTiming(props.line)
})

const currentWordIndex = computed(() =>
  activeWordIndex(props.line, props.progressMs, playbackOptions.value)
)

defineExpose({
  rowElement,
})
</script>

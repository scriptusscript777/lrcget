<template>
  <div
    class="mt-2 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
    data-testid="word-playback-preview"
    role="group"
    aria-label="Word playback preview"
  >
    <div class="text-xs text-neutral-600 dark:text-neutral-400">Word preview</div>
    <div
      ref="textContainer"
      class="relative max-h-24 overflow-y-auto py-1 text-lg leading-relaxed whitespace-pre-wrap"
      data-testid="word-preview-text"
    >
      <span
        v-for="(word, index) in previewWords"
        :key="index"
        :data-active="word.active"
        data-testid="word-preview-word"
        class="rounded px-0.5"
        :class="word.active ? 'bg-hoa-1500 text-white' : 'text-neutral-800 dark:text-neutral-200'"
        >{{ word.text }}</span
      >
      <span v-if="!previewWords.length" class="text-sm text-neutral-600 dark:text-neutral-400"
        >Select a sentence with start and end times to preview words.</span
      >
    </div>
    <p
      v-if="previewWords.length && !hasSavedTiming && !hasPartialTiming"
      class="text-xs text-neutral-600 dark:text-neutral-400"
    >
      Evenly spaced preview. Sync words to match the recording before exporting word timing.
    </p>
    <p v-if="hasPartialTiming" class="text-xs text-neutral-600 dark:text-neutral-400">
      Partial word timing. Untimed words stay unhighlighted until synced.
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  distributeWordTimings,
  generateWordsFromLine,
  hasValidWords,
} from '@/utils/word-tokenizer.js'
import { activeWordIndex } from '@/utils/word-playback.js'

const props = defineProps({
  line: { type: Object, default: null },
  allLines: { type: Array, default: () => [] },
  lineIndex: { type: Number, default: -1 },
  progressMs: { type: Number, default: 0 },
  playing: { type: Boolean, default: false },
  previewRange: { type: Object, default: null },
})
const hasSavedTiming = computed(
  () => hasValidWords(props.line) && props.line.words.every(word => Number.isFinite(word.start_ms))
)
const hasPartialTiming = computed(
  () =>
    hasValidWords(props.line) &&
    !hasSavedTiming.value &&
    props.line.words.some(word => Number.isFinite(word.start_ms))
)
const inferredEndMs = computed(() => props.allLines[props.lineIndex + 1]?.start_ms)
const previewLine = computed(() => {
  const line = props.line
  if (!line) return null
  // Use live edited word data directly, even while only some words have timings.
  if (hasSavedTiming.value || hasPartialTiming.value) return line
  const endMs = line.end_ms ?? inferredEndMs.value
  if (!Number.isFinite(line.start_ms) || !Number.isFinite(endMs) || endMs <= line.start_ms)
    return null
  const words = hasValidWords(line) ? line.words : generateWordsFromLine(line)
  return { ...line, words: distributeWordTimings(words, line.start_ms, endMs) }
})
const activeIndex = computed(() =>
  activeWordIndex(previewLine.value, props.progressMs, {
    previewRange: props.previewRange,
    inferredEndMs: inferredEndMs.value,
  })
)
const previewWords = computed(() =>
  (previewLine.value?.words ?? []).map((word, index) => ({
    text: word.text,
    active: index === activeIndex.value,
  }))
)
// The text view wraps independently of timeline zoom; never changes word boundaries.
const textContainer = ref(null)
watch(
  [activeIndex, () => props.line, () => props.playing],
  async () => {
    if (!props.playing) return
    await nextTick()
    const container = textContainer.value
    const active = container?.querySelector('[data-active="true"]')
    if (!active) return
    const top = active.offsetTop
    if (top < container.scrollTop) container.scrollTop = top
    else if (top + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + active.offsetHeight - container.clientHeight
    }
  },
  { flush: 'post', immediate: true }
)
</script>

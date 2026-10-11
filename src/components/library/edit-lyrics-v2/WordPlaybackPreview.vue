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
      v-if="previewWords.length && !hasSavedTiming"
      class="text-xs text-neutral-600 dark:text-neutral-400"
    >
      Evenly spaced preview. Sync words to match the recording before exporting word timing.
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ensureLineWords, hasValidWords } from '@/utils/word-tokenizer.js'

const props = defineProps({
  line: { type: Object, default: null },
  allLines: { type: Array, default: () => [] },
  lineIndex: { type: Number, default: -1 },
  progressMs: { type: Number, default: 0 },
  playing: { type: Boolean, default: false },
})
const hasSavedTiming = computed(() => hasValidWords(props.line))
const previewWords = computed(() => {
  if (!props.line || !Number.isFinite(props.line.start_ms) || !Number.isFinite(props.line.end_ms))
    return []
  const words = ensureLineWords(props.line, props.allLines, props.lineIndex).words || []
  return words.map((word, index) => {
    const next = words[index + 1]?.start_ms ?? props.line.end_ms
    const end = Math.min(Number.isFinite(word.end_ms) ? word.end_ms : next, next, props.line.end_ms)
    return {
      text: word.text,
      active:
        Number.isFinite(props.progressMs) &&
        props.progressMs >= word.start_ms &&
        props.progressMs < end,
    }
  })
})
// The text view wraps independently of timeline zoom; never changes word boundaries.
const textContainer = ref(null)
const activeIndex = computed(() => previewWords.value.findIndex(word => word.active))
watch(
  activeIndex,
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
  { flush: 'post' }
)
</script>

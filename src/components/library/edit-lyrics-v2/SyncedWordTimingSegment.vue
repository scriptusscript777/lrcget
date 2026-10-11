<template>
  <div
    v-tooltip="
      editorTooltip(
        `${word.text}: ${formatTimestampMs(startMs)} - ${formatTimestampMs(endMs)}. Drag its divider to adjust timing; edit wording in the sentence row.`
      )
    "
    class="word-segment absolute flex items-center justify-center py-1 text-sm select-none h-full overflow-visible"
    :class="segmentClass"
    :style="segmentStyle"
    :title="`${word.text} (${formatTimestampMs(startMs)} - ${formatTimestampMs(endMs)})`"
    tabindex="0"
    role="button"
    :aria-label="`Select word ${wordIndex + 1}: ${word.text.trim()}`"
    :aria-pressed="selected"
    @focus="emit('select-word', wordIndex)"
    @click.stop="emit('select-word', wordIndex)"
    @keydown.enter.prevent.stop="emit('select-word', wordIndex)"
    @keydown.space.prevent.stop="emit('select-word', wordIndex)"
    @dblclick.stop="emit('select-word', wordIndex)"
  >
    <span class="sticky left-1 z-10 block max-w-full overflow-hidden whitespace-nowrap text-clip">{{
      word.text
    }}</span>
  </div>
</template>

<script setup>
import { vTooltip, editorTooltip } from '@/utils/editor-tooltip.js'
import { computed } from 'vue'
import { formatTimestampMs } from '@/utils/lyricsfile.js'
const emit = defineEmits(['select-word'])
const props = defineProps({
  selected: Boolean,
  word: { type: Object, required: true },
  wordIndex: { type: Number, required: true },
  startMs: { type: Number, default: 0 },
  endMs: { type: Number, default: 0 },
  lineStartMs: { type: Number, default: 0 },
  lineEndMs: { type: Number, default: 0 },
  timelineWidth: { type: Number, default: 0 },
  progressMs: { type: Number, default: 0 },
})
const isPlaying = computed(() => {
  // The word is playing when: startMs <= currentTime < endMs
  return props.progressMs >= props.startMs && props.progressMs < props.endMs
})

const segmentClass = computed(() => {
  if (isPlaying.value) {
    return [
      'bg-hoa-1500 dark:bg-hoa-1500',
      'text-white dark:text-white',
      'font-bold',
      'border-r border-hoa-1500 dark:border-hoa-1500',
    ]
  }

  return [
    'bg-neutral-200 dark:bg-neutral-700',
    'text-neutral-800 dark:text-neutral-300',
    'border-r',
    'border-neutral-300',
    'dark:border-neutral-600',
  ]
})

const segmentStyle = computed(() => {
  if (!props.timelineWidth || props.lineEndMs <= props.lineStartMs) {
    return {}
  }

  const duration = props.lineEndMs - props.lineStartMs
  const leftPercent = ((props.startMs - props.lineStartMs) / duration) * 100
  const wordDuration = Math.max(0, props.endMs - props.startMs)
  const widthPercent = (wordDuration / duration) * 100
  const padding = (wordDuration / duration) * props.timelineWidth < 24 ? '0' : '4px'

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    paddingLeft: padding,
    paddingRight: padding,
    transition: 'none',
  }
})
</script>
<style scoped>
.word-segment {
  user-select: none;
  touch-action: none;
}
.word-segment[aria-pressed='true'],
.word-segment:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
  z-index: 10;
}
</style>

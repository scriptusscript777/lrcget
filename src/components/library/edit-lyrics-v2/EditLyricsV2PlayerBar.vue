<template>
  <div class="flex gap-4 items-center px-4 py-2">
    <button
      v-if="status !== 'playing'"
      v-tooltip="editorTooltip('Play or resume this recording; Loop repeats the marker range when enabled')"
      title="Play or resume this recording"
      aria-label="Play or resume this recording"
      class="button button-normal p-2 rounded-full text-xl"
      @click.prevent="emit('play-toggle')"
    >
      <Play />
    </button>
    <button
      v-else
      v-tooltip="editorTooltip('Pause playback without changing your markers or timestamps')"
      title="Pause playback"
      aria-label="Pause playback"
      class="button button-normal p-2 rounded-full text-xl"
      @click.prevent="emit('pause')"
    >
      <Pause />
    </button>
    <div class="flex-none w-12 text-xs text-neutral-600 dark:text-neutral-400">
      {{ humanDuration(progress) }}
    </div>
    <Seek class="grow" :duration="duration" :progress="progress" @seek="emit('seek', $event)" />
    <div class="flex-none w-12 text-xs text-neutral-600 dark:text-neutral-400">
      {{ humanDuration(duration) }}
    </div>

    <PlaybackSpeedControl
      :model-value="playbackSpeed"
      @update:model-value="emit('set-playback-speed', $event)"
    />
  </div>
</template>

<script setup>
import { vTooltip, editorTooltip } from '@/utils/editor-tooltip.js'
import Play from '~icons/mdi/play'
import Pause from '~icons/mdi/pause'
import Seek from '@/components/now-playing/Seek.vue'
import PlaybackSpeedControl from '@/components/common/PlaybackSpeedControl.vue'

defineProps({
  status: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 0,
  },
  progress: {
    type: Number,
    default: 0,
  },
  playbackSpeed: {
    type: Number,
    default: 1.0,
  },
})

const emit = defineEmits(['play-toggle', 'pause', 'seek', 'set-playback-speed'])

const humanDuration = seconds => {
  const boundedSeconds = seconds || 0
  return new Date(boundedSeconds * 1000).toISOString().slice(11, 19)
}
</script>

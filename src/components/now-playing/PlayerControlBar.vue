<template>
  <section
    class="flex flex-none flex-col items-center justify-center gap-3 bg-neutral-50 px-4 py-3 backdrop-blur dark:bg-neutral-900"
    :class="{ 'border-t border-neutral-200/70 dark:border-neutral-800': karaoke }"
    aria-label="Audio player controls"
    data-testid="player-control-bar"
  >
    <div class="flex w-full items-center justify-center gap-1">
      <div class="w-12 flex-none text-xs text-neutral-800 dark:text-neutral-500">
        {{ humanDuration(progress) }}
      </div>
      <Seek class="grow" :duration="duration" :progress="progress" @seek="seek" />
      <div class="w-12 flex-none text-right text-xs text-neutral-800 dark:text-neutral-500">
        {{ humanDuration(duration) }}
      </div>
    </div>

    <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <div class="flex min-w-0 flex-col items-start justify-center gap-0.5">
        <div v-if="playingTrack" class="min-w-0 max-w-full">
          <div class="line-clamp-1 text-xs font-bold text-neutral-800 dark:text-neutral-200">
            {{ playingTrack.title }}
          </div>
          <div class="line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span class="cursor-pointer hover:underline" @click="goToAlbum">
              {{ playingTrack.album_name }}
            </span>
            <span> · </span>
            <span class="cursor-pointer hover:underline" @click="goToArtist">
              {{ playingTrack.artist_name }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-0.5">
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1"
          :class="shuffle ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'"
          :aria-pressed="shuffle"
          aria-label="Toggle shuffle"
          title="Shuffle"
          @click="toggleShuffle"
        >
          <Shuffle />
        </button>
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
          aria-label="Previous track"
          title="Previous track"
          :disabled="!canPlayPrevious"
          @click="playAdjacentTrack(-1)"
        >
          <SkipPrevious />
        </button>
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
          aria-label="Back 10 seconds"
          title="Back 10 seconds"
          :disabled="!playingTrack"
          @click.prevent="seek(reverse10)"
        >
          <Rewind_10 />
        </button>
        <button
          v-if="status === 'playing'"
          type="button"
          class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
          aria-label="Pause song"
          @click.prevent="pause"
        >
          <Pause />
        </button>
        <button
          v-else-if="playingTrack && status === 'stopped'"
          type="button"
          class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
          aria-label="Restart song"
          @click.prevent="playTrack(playingTrack)"
        >
          <Replay />
        </button>
        <button
          v-else
          type="button"
          class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
          aria-label="Play song"
          :disabled="!playingTrack"
          @click.prevent="resume"
        >
          <Play />
        </button>
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
          aria-label="Forward 10 seconds"
          title="Forward 10 seconds"
          :disabled="!playingTrack"
          @click.prevent="seek(forward10)"
        >
          <FastForward_10 />
        </button>
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
          aria-label="Next track"
          title="Next track"
          :disabled="!canPlayNext"
          @click="playAdjacentTrack(1)"
        >
          <SkipNext />
        </button>
        <button
          type="button"
          class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1"
          :class="repeatMode !== 'off' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'"
          :aria-pressed="repeatMode !== 'off'"
          :aria-label="repeatLabel"
          :title="`${repeatLabel} (click to change)`"
          @click="cycleRepeatMode"
        >
          <RepeatOnce v-if="repeatMode === 'one'" />
          <Repeat v-else />
        </button>
      </div>

      <div class="flex min-w-0 items-center justify-end gap-2">
        <PlaybackSpeedControl :model-value="playbackSpeed" @update:model-value="setPlaybackSpeed" />
        <VolumeSlider :volume="volume" @set-volume="setVolume" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Seek from './Seek.vue'
import PlaybackSpeedControl from '@/components/common/PlaybackSpeedControl.vue'
import Play from '~icons/mdi/play'
import Pause from '~icons/mdi/pause'
import Replay from '~icons/mdi/replay'
import Rewind_10 from '~icons/mdi/rewind-10'
import FastForward_10 from '~icons/mdi/fast-forward-10'
import Shuffle from '~icons/mdi/shuffle'
import Repeat from '~icons/mdi/repeat'
import RepeatOnce from '~icons/mdi/repeat-once'
import SkipPrevious from '~icons/mdi/skip-previous'
import SkipNext from '~icons/mdi/skip-next'
import { usePlayer } from '@/composables/player.js'
import { useLibraryNavigation } from '@/composables/library-navigation.js'
import VolumeSlider from './VolumeSlider.vue'
import { humanDuration } from '@/utils/human-duration.js'

defineProps({ karaoke: { type: Boolean, default: false } })

const { navigateToAlbum, navigateToArtist } = useLibraryNavigation()
const {
  playingTrack,
  status,
  duration,
  progress,
  volume,
  playbackSpeed,
  queue,
  shuffle,
  repeatMode,
  playTrack,
  pause,
  resume,
  seek,
  setVolume,
  setPlaybackSpeed,
  toggleShuffle,
  cycleRepeatMode,
  playAdjacentTrack,
} = usePlayer()

const repeatLabel = computed(() => {
  if (repeatMode.value === 'one') return 'Repeat one'
  if (repeatMode.value === 'all') return 'Repeat all'
  return 'Repeat off'
})

const currentQueueIndex = computed(() => queue.value.indexOf(playingTrack.value?.id))
const canPlayPrevious = computed(
  () => currentQueueIndex.value > 0 || (currentQueueIndex.value === 0 && repeatMode.value === 'all')
)
const canPlayNext = computed(
  () =>
    currentQueueIndex.value >= 0 &&
    (currentQueueIndex.value < queue.value.length - 1 ||
      repeatMode.value === 'all' ||
      (shuffle.value && queue.value.length > 1))
)
const reverse10 = computed(() =>
  Number.isFinite(progress.value) ? Math.max(0, progress.value - 10) : null
)
const forward10 = computed(() =>
  Number.isFinite(progress.value) && Number.isFinite(duration.value)
    ? Math.min(duration.value - 1, progress.value + 10)
    : null
)

const goToAlbum = () => {
  if (playingTrack.value?.album_id) navigateToAlbum(playingTrack.value.album_id)
}
const goToArtist = () => {
  if (playingTrack.value?.artist_id) navigateToArtist(playingTrack.value.artist_id)
}
</script>

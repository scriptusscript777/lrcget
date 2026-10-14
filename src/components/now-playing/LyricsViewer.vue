<template>
  <transition name="slide-fade" mode="out-in">
    <div
      v-if="syncedLines.length > 0 && duration != null && progress != null"
      class="flex flex-col gap-1 relative"
    >
      <transition name="slide-fade" mode="out-in">
        <section
          v-if="karaokeMode"
          ref="karaokeDialog"
          class="fixed inset-0 z-[100] flex flex-col bg-neutral-50 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          role="dialog"
          aria-modal="true"
          aria-label="Karaoke lyrics display"
          tabindex="-1"
          data-testid="karaoke-display"
          @keydown.esc="closeKaraoke"
        >
          <header
            class="flex flex-none items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:px-8"
          >
            <div class="min-w-0">
              <h1 class="truncate text-lg font-bold sm:text-xl">{{ trackTitle || 'Karaoke' }}</h1>
              <p v-if="trackArtist" class="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {{ trackArtist }}
              </p>
              <p v-else class="text-xs text-neutral-500 dark:text-neutral-400">Karaoke lyrics</p>
            </div>
            <div class="flex flex-none items-center gap-2">
              <div
                v-if="hasBothTimingFormats"
                class="flex items-center rounded-lg bg-neutral-200 p-0.5 text-xs dark:bg-neutral-800"
                role="group"
                aria-label="Lyrics timing format"
              >
                <button
                  type="button"
                  class="rounded-md px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  :class="
                    activeTimingFormat === 'word' ? 'bg-white shadow dark:bg-neutral-700' : ''
                  "
                  :aria-pressed="activeTimingFormat === 'word'"
                  @click="activeTimingFormat = 'word'"
                >
                  Word
                </button>
                <button
                  type="button"
                  class="rounded-md px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  :class="
                    activeTimingFormat === 'line' ? 'bg-white shadow dark:bg-neutral-700' : ''
                  "
                  :aria-pressed="activeTimingFormat === 'line'"
                  @click="activeTimingFormat = 'line'"
                >
                  Line
                </button>
              </div>
              <button
                class="rounded-md p-2 text-sm hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-neutral-800"
                type="button"
                :aria-label="copied ? 'Lyrics copied' : 'Copy lyrics'"
                title="Copy lyrics"
                @click="onCopy"
              >
                <ContentCopy class="h-5 w-5" />
              </button>
              <button
                class="rounded-md p-2 text-sm hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-neutral-800"
                type="button"
                aria-label="Close karaoke display"
                title="Close karaoke display"
                data-testid="close-karaoke-display"
                @click="closeKaraoke"
              >
                <CloseIcon class="h-6 w-6" />
              </button>
            </div>
          </header>

          <main
            ref="lyricsViewport"
            class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-10"
          >
            <div
              id="full-lyrics-container"
              ref="fullLyricsContainer"
              class="absolute left-0 top-0 w-full space-y-8 px-5 text-center text-xl leading-relaxed transition-transform sm:px-10 sm:text-3xl lg:text-4xl"
              :style="{ transform: fullViewTransform }"
            >
              <p
                v-for="(line, index) in displayLines"
                :key="index"
                class="mx-auto max-w-5xl whitespace-pre-wrap transition-colors duration-150"
                :class="{
                  'font-bold text-neutral-950 dark:text-white': isLinePlaying(line, index),
                  'text-neutral-400 dark:text-neutral-600': !isLinePlaying(line, index),
                  'cursor-pointer': Number.isFinite(line.start_ms),
                }"
                data-testid="karaoke-line"
                :role="Number.isFinite(line.start_ms) ? 'button' : undefined"
                :tabindex="Number.isFinite(line.start_ms) ? 0 : undefined"
                :aria-label="
                  Number.isFinite(line.start_ms)
                    ? `Seek to ${humanDuration(line.start_ms / 1000)}: ${line.text}`
                    : undefined
                "
                @click="onLineClick(line)"
                @keydown.enter.prevent="onLineClick(line)"
                @keydown.space.prevent="onLineClick(line)"
              >
                <template v-if="hasWordSync(displayLines, index)">
                  <span
                    v-for="(word, wordIndex) in getLineWords(displayLines, index)"
                    :key="wordIndex"
                    class="whitespace-pre-wrap transition-colors duration-100"
                    :class="{
                      'rounded-sm bg-yellow-200 text-yellow-950 dark:bg-yellow-400/25 dark:text-yellow-200':
                        isLinePlaying(line, index) &&
                        isWordPlaying(displayLines, index, wordIndex, progressMs),
                    }"
                    >{{ word.text }}</span
                  >
                </template>
                <template v-else>{{ line.text }}</template>
              </p>
            </div>
            <p
              v-if="karaokeNotice"
              class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-neutral-900/90 px-4 py-2 text-center text-sm text-white shadow-lg"
              role="status"
              aria-live="polite"
            >
              {{ karaokeNotice }}
            </p>
            <div
              class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-50 dark:from-neutral-950"
            />
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-50 dark:from-neutral-950"
            />
          </main>

          <PlayerControlBar karaoke />
        </section>
      </transition>

      <transition name="slide-fade" mode="out-in">
        <section
          v-if="expanded"
          class="absolute bottom-0 left-0 z-20 flex h-[40vh] w-full flex-col overflow-hidden border-t border-neutral-200/70 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
          aria-label="Expanded lyrics"
        >
          <button
            type="button"
            class="flex h-8 flex-none items-center justify-center text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-neutral-300"
            aria-label="Collapse expanded lyrics"
            @click="toggleExpanded"
          >
            <DragHorizontal />
          </button>
          <div
            ref="inlineLyricsViewport"
            class="relative min-h-0 flex-1 overflow-hidden text-center"
          >
            <div
              ref="inlineLyricsContainer"
              class="absolute left-0 top-0 w-full space-y-3 px-4 text-base leading-relaxed transition-transform sm:text-lg"
              :style="{ transform: inlineLyricsTransform }"
            >
              <p
                v-for="(line, index) in displayLines"
                :key="index"
                class="mx-auto max-w-5xl whitespace-pre-wrap transition-colors"
                :class="{
                  'font-bold text-neutral-950 dark:text-white': isLinePlaying(line, index),
                  'text-neutral-400 dark:text-neutral-600': !isLinePlaying(line, index),
                }"
                @click="onLineClick(line)"
              >
                <template v-if="hasWordSync(displayLines, index)">
                  <span
                    v-for="(word, wordIndex) in getLineWords(displayLines, index)"
                    :key="wordIndex"
                    :class="{
                      'text-yellow-500 dark:text-yellow-400':
                        isLinePlaying(line, index) &&
                        isWordPlaying(displayLines, index, wordIndex, progressMs),
                    }"
                    >{{ word.text }}</span
                  >
                </template>
                <template v-else>{{ line.text }}</template>
              </p>
            </div>
          </div>
        </section>
      </transition>

      <div
        class="mini-viewer transition cursor-pointer top-0 left-0 w-full h-12 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200/50 dark:border-neutral-800/50 flex flex-col"
        :class="{ 'invisible opacity-0': expanded }"
        @click="toggleExpanded"
      >
        <div class="flex justify-center items-center h-4 w-full">
          <button
            class="text-xl text-neutral-800 dark:text-neutral-400 w-full flex justify-center"
            type="button"
            :aria-label="expanded ? 'Collapse expanded lyrics' : 'Expand lyrics'"
            @click.stop="toggleExpanded"
          >
            <DragHorizontal />
          </button>
        </div>

        <transition name="slide-fade" mode="out-in">
          <div
            :key="currentLyrics"
            class="flex w-full justify-center items-center text-neutral-800 dark:text-neutral-200 text-sm grow font-bold"
          >
            <template v-if="hasWordSync(displayLines, primaryPlayingLineIndex)">
              <span
                v-for="(word, wordIndex) in getLineWords(displayLines, primaryPlayingLineIndex)"
                :key="wordIndex"
                class="whitespace-pre-wrap"
                :class="{
                  'text-yellow-500 dark:text-yellow-400': isWordPlaying(
                    displayLines,
                    primaryPlayingLineIndex,
                    wordIndex,
                    progressMs
                  ),
                }"
                >{{ word.text }}</span
              >
            </template>
            <template v-else>
              {{ currentLyrics }}
            </template>
          </div>
        </transition>
      </div>
    </div>
  </transition>
</template>

<script setup>
import ContentCopy from '~icons/mdi/content-copy'
import DragHorizontal from '~icons/mdi/drag-horizontal'
import CloseIcon from '~icons/mdi/close'
import PlayerControlBar from './PlayerControlBar.vue'
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { humanDuration } from '@/utils/human-duration.js'
import { getCurrentWordIndex } from '@/utils/karaoke-timing.js'
import { parseLyricsfile, parseLrcLines } from '@/utils/lyricsfile.js'

const props = defineProps({
  duration: { type: Number, default: undefined },
  progress: { type: Number, default: undefined },
  lyricsfile: { type: String, default: undefined },
  lrcLyrics: { type: String, default: '' },
  elrcLyricsfile: { type: String, default: '' },
  karaokeNotice: { type: String, default: '' },
  karaokeMode: { type: Boolean, default: false },
  trackTitle: { type: String, default: '' },
  trackArtist: { type: String, default: '' },
})
const emit = defineEmits(['lyricsClicked', 'closeKaraoke'])

const currentLineTranslate = ref(0)
const inlineLineTranslate = ref(0)
const expanded = ref(false)
const karaokeDialog = ref(null)
const lyricsViewport = ref(null)
const fullLyricsContainer = ref(null)
const inlineLyricsViewport = ref(null)
const inlineLyricsContainer = ref(null)
const copied = ref(false)
const activeTimingFormat = ref('word')

const parsedLyricsfile = computed(() => {
  const content =
    activeTimingFormat.value === 'word' && props.elrcLyricsfile
      ? props.elrcLyricsfile
      : props.lyricsfile
  if (!content) {
    return null
  }
  return parseLyricsfile(content)
})

const syncedLines = computed(() => {
  if (!parsedLyricsfile.value) {
    return []
  }
  return parsedLyricsfile.value.syncedLines || []
})

const lrcLines = computed(() => parseLrcLines(props.lrcLyrics))
const hasWordTimedLyrics = computed(() =>
  syncedLines.value.some(line => line.words?.some(word => Number.isFinite(word.start_ms)))
)
const hasTimedSyncedLines = computed(() =>
  syncedLines.value.some(
    line =>
      Number.isFinite(line.start_ms) &&
      (line.text.trim().length > 0 || line.words?.some(word => word.text.trim().length > 0))
  )
)
const hasBothTimingFormats = computed(() => hasWordTimedLyrics.value && lrcLines.value.length > 0)
const displayLines = computed(() => {
  if (activeTimingFormat.value === 'line' && lrcLines.value.length > 0) return lrcLines.value
  if (hasWordTimedLyrics.value || hasTimedSyncedLines.value) return syncedLines.value
  if (lrcLines.value.length > 0) return lrcLines.value
  return syncedLines.value
})

const progressMs = computed(() => (props.progress ?? 0) * 1000)

// Check if a line is currently playing based on its own time range
const isLinePlaying = (line, index) => {
  if (!line || !Number.isFinite(line.start_ms)) {
    return false
  }
  const lineStart = line.start_ms
  const lineEnd = Number.isFinite(line.end_ms)
    ? line.end_ms
    : (displayLines.value[index + 1]?.start_ms ?? Infinity)
  return progressMs.value >= lineStart && progressMs.value < lineEnd
}

// For minimal view: find the primary playing line (prioritize by start time if multiple overlap)
const primaryPlayingLineIndex = computed(() => {
  const lines = displayLines.value
  if (!lines || lines.length === 0) {
    return -1
  }

  // Find all lines that are currently playing
  const playingIndices = []
  for (let i = 0; i < lines.length; i++) {
    if (isLinePlaying(lines[i], i)) {
      playingIndices.push(i)
    }
  }

  if (playingIndices.length === 0) {
    // No line is playing, find the most recent past line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (progressMs.value >= lines[i].start_ms) {
        return i
      }
    }
    return -1
  }

  // Return the line with the latest start time (most recently started)
  return playingIndices[playingIndices.length - 1]
})

const currentLyrics = computed(() => {
  const index = primaryPlayingLineIndex.value
  if (index === null || index < 0 || index >= displayLines.value.length) {
    return '…'
  }
  const line = displayLines.value[index]
  return line?.text || '…'
})

const hasWordSync = (lines, index) => {
  if (!lines || index === null || index < 0) {
    return false
  }
  const line = lines[index]
  return line && line.words && Array.isArray(line.words) && line.words.length > 0
}

const getLineWords = (lines, index) => {
  if (!lines || index === null || index < 0) {
    return []
  }
  const line = lines[index]
  if (!line || !line.words || !Array.isArray(line.words)) {
    return []
  }
  return line.words
}

const isWordPlaying = (lines, lineIndex, wordIndex, progressMs) => {
  if (!lines || lineIndex === null || lineIndex < 0) {
    return false
  }
  const line = lines[lineIndex]
  if (!line || !line.words || !Array.isArray(line.words)) {
    return false
  }
  return getCurrentWordIndex(line, progressMs) === wordIndex
}

// For expanded view scrolling: use the primary playing line for scroll position
const updateCurrentLineElementOffset = () => {
  const newCurrentIndex = primaryPlayingLineIndex.value

  if (newCurrentIndex === -1) {
    currentLineTranslate.value = (lyricsViewport.value?.clientHeight || 0) / 2
    inlineLineTranslate.value = (inlineLyricsViewport.value?.clientHeight || 0) / 2
    return
  }

  const fullLyricsContainerEl = fullLyricsContainer.value
  const viewport = lyricsViewport.value
  if (fullLyricsContainerEl && viewport) {
    const currentLyricsLine = Array.from(fullLyricsContainerEl.children)[newCurrentIndex]
    if (currentLyricsLine) {
      currentLineTranslate.value =
        viewport.clientHeight / 2 - currentLyricsLine.offsetTop - currentLyricsLine.offsetHeight / 2
    }
  }

  const inlineContainer = inlineLyricsContainer.value
  const inlineViewport = inlineLyricsViewport.value
  if (inlineContainer && inlineViewport) {
    const currentLine = Array.from(inlineContainer.children)[newCurrentIndex]
    if (currentLine) {
      inlineLineTranslate.value =
        inlineViewport.clientHeight / 2 - currentLine.offsetTop - currentLine.offsetHeight / 2
    }
  }
}

const fullViewTransform = computed(() => `translateY(${currentLineTranslate.value}px)`)
const inlineLyricsTransform = computed(() => `translateY(${inlineLineTranslate.value}px)`)

const closeKaraoke = () => emit('closeKaraoke')
const toggleExpanded = () => {
  expanded.value = !expanded.value
  nextTick(updateCurrentLineElementOffset)
}

const onLineClick = line => {
  if (Number.isFinite(line?.start_ms) && line.start_ms >= 0) {
    emit('lyricsClicked', { timestamp: line.start_ms / 1000 })
  }
}

const onCopy = async () => {
  try {
    const text = syncedLines.value.map(l => l.text).join('\n')
    if (!text) return
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // swallow
  }
}

watch(
  [() => props.progress, syncedLines, () => props.karaokeMode, expanded],
  () => {
    if (props.karaokeMode || expanded.value) {
      nextTick(updateCurrentLineElementOffset)
    }
  },
  { immediate: true }
)

watch(
  () => props.karaokeMode,
  isOpen => {
    if (isOpen) nextTick(() => karaokeDialog.value?.focus?.())
  }
)

onMounted(() => window.addEventListener('resize', updateCurrentLineElementOffset))
onUnmounted(() => window.removeEventListener('resize', updateCurrentLineElementOffset))
</script>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.05s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.05s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.slide-fade-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
</style>

<template>
  <section
    class="min-w-0 border-t border-neutral-200 px-3 pb-2 pt-1 dark:border-neutral-700"
    aria-label="Audio waveform"
    data-testid="editor-waveform"
    @keydown.stop
  >
    <div
      class="flex min-w-0 items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400"
    >
      <span class="min-w-0 truncate tabular-nums" data-testid="waveform-window">
        {{
          waveform
            ? `${formatTime(viewport.start)} - ${formatTime(viewport.start + viewport.span)}`
            : 'Waveform'
        }}
      </span>
      <div class="flex shrink-0 items-center gap-1">
        <button
          class="button button-normal h-7 w-7 rounded"
          aria-label="Zoom out waveform"
          title="Zoom out waveform"
          :disabled="!waveform || viewport.span >= waveform.duration"
          @click="zoom(2)"
        >
          <MagnifyMinus />
        </button>
        <button
          class="button button-normal h-7 w-7 rounded"
          aria-label="Zoom in waveform"
          title="Zoom in waveform"
          :disabled="!waveform || viewport.span <= minimumSpan"
          @click="zoom(0.5)"
        >
          <MagnifyPlus />
        </button>
        <button
          class="button button-normal h-7 w-7 rounded"
          aria-label="Fit entire waveform"
          title="Fit entire waveform"
          :disabled="!waveform || viewport.span >= waveform.duration"
          @click="fit"
        >
          <Fit />
        </button>
      </div>
    </div>
    <div ref="plot" class="relative h-[110px] min-w-0">
      <canvas
        ref="canvas"
        class="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div
        v-if="waveform"
        class="absolute inset-x-0 top-0 h-[90px] cursor-crosshair rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-hoa-500"
        role="slider"
        tabindex="0"
        aria-label="Seek in waveform"
        aria-valuemin="0"
        :aria-valuemax="waveform.duration"
        :aria-valuenow="cursorTime"
        :aria-valuetext="formatTime(cursorTime)"
        data-testid="waveform-seek"
        @click="seekAtPointer"
        @keydown="seekAtKey"
      >
        <span
          v-if="playheadVisible"
          class="pointer-events-none absolute top-0 h-full w-px bg-hoa-600 dark:bg-hoa-400"
          :style="{ left: `${playheadPercent}%` }"
          data-testid="waveform-playhead"
        />
      </div>
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center gap-2 text-xs text-neutral-600 dark:text-neutral-400"
        role="status"
        :aria-busy="loading"
      >
        <span v-if="loading">Loading waveform...</span>
        <template v-else-if="error">
          <span
            class="max-h-[72px] min-w-0 overflow-y-auto break-words"
            data-testid="waveform-error"
            >{{ error }}</span
          >
          <button class="button button-normal shrink-0 rounded px-2 py-1" @click="retry">
            Retry
          </button>
        </template>
        <span v-else>No audio available</span>
      </div>
    </div>
    <div class="h-3">
      <input
        v-if="waveform && viewport.span < waveform.duration"
        class="block h-3 w-full accent-hoa-600"
        type="range"
        min="0"
        :max="waveform.duration - viewport.span"
        :step="Math.max(0.001, viewport.span / 1000)"
        :value="viewport.start"
        aria-label="Pan waveform"
        data-testid="waveform-pan"
        @input="pan(Number($event.target.value))"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import MagnifyMinus from '~icons/mdi/magnify-minus-outline'
import MagnifyPlus from '~icons/mdi/magnify-plus-outline'
import Fit from '~icons/mdi/fit-to-screen-outline'
import { useAudioWaveform } from '@/composables/edit-lyrics-v2/useAudioWaveform.js'
import {
  aggregatePeaks,
  clampTime,
  normalizeViewport,
  pixelToTime,
  timeToPixel,
  zoomViewport,
} from '@/utils/waveform-viewport.js'

const props = defineProps({
  audioSource: { type: Object, required: true },
  progress: { type: Number, default: null },
})
const emit = defineEmits(['seek'])
const { waveform, loading, error, retry } = useAudioWaveform(toRef(props, 'audioSource'))
const viewport = ref({ start: 0, span: 0 })
const canvas = ref(null)
const plot = ref(null)
const width = ref(0)
const minimumSpan = computed(() =>
  Math.min(waveform.value?.duration || 1, Math.max(1, (waveform.value?.secondsPerPeak || 0) * 2))
)
const cursorTime = computed(() => clampTime(props.progress, waveform.value?.duration))
const playheadVisible = computed(
  () =>
    Number.isFinite(props.progress) &&
    props.progress >= viewport.value.start &&
    props.progress <= viewport.value.start + viewport.value.span
)
const playheadPercent = computed(() =>
  Math.max(0, Math.min(100, timeToPixel(cursorTime.value, viewport.value, 100)))
)
let resizeObserver
let themeObserver
let frame = 0
let disposed = false

const formatTime = seconds => {
  const tenths = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 10)
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`
}

const fit = () => {
  viewport.value = normalizeViewport(waveform.value?.duration)
}
const zoom = factor => {
  viewport.value = zoomViewport(
    waveform.value.duration,
    viewport.value,
    factor,
    props.progress,
    minimumSpan.value
  )
}
const pan = start => {
  viewport.value = normalizeViewport(waveform.value.duration, start, viewport.value.span)
}
const seekAtPointer = event => {
  const bounds = event.currentTarget.getBoundingClientRect()
  emit(
    'seek',
    pixelToTime(event.clientX - bounds.left, viewport.value, bounds.width, waveform.value.duration)
  )
}
const seekAtKey = event => {
  const step = event.shiftKey ? 5 : 0.1
  const targets = {
    ArrowLeft: cursorTime.value - step,
    ArrowRight: cursorTime.value + step,
    Home: 0,
    End: waveform.value.duration,
  }
  if (!(event.key in targets)) return
  event.preventDefault()
  emit('seek', clampTime(targets[event.key], waveform.value.duration))
}

const draw = () => {
  frame = 0
  const element = canvas.value
  if (!element || !width.value) return
  const dpr = window.devicePixelRatio || 1
  const height = 110
  element.width = Math.round(width.value * dpr)
  element.height = Math.round(height * dpr)
  const context = element.getContext('2d')
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width.value, height)
  if (!waveform.value) return
  const dark = document.documentElement.classList.contains('dark')
  const columns = aggregatePeaks(
    waveform.value.peaks,
    waveform.value.secondsPerPeak,
    viewport.value,
    width.value
  )
  context.fillStyle = dark ? '#a3a3a3' : '#525252'
  for (let x = 0; x < columns.length; x++) {
    const amplitude = columns[x] * 40
    context.fillRect(x, 45 - amplitude, 1, Math.max(1, amplitude * 2))
  }
  context.fillStyle = dark ? '#737373' : '#a3a3a3'
  context.fillRect(0, 90, width.value, 1)
  context.font = '10px ' + getComputedStyle(element).fontFamily
  context.fillStyle = dark ? '#a3a3a3' : '#525252'
  const divisions = Math.max(1, Math.floor(width.value / 100))
  for (let tick = 0; tick <= divisions; tick++) {
    const x = (tick / divisions) * width.value
    const time = viewport.value.start + (tick / divisions) * viewport.value.span
    context.textAlign = tick === 0 ? 'left' : tick === divisions ? 'right' : 'center'
    context.fillRect(Math.min(x, width.value - 1), 91, 1, 3)
    context.fillText(formatTime(time), x, 106)
  }
}
const scheduleDraw = () => {
  if (!disposed && !frame) frame = requestAnimationFrame(draw)
}

watch(waveform, fit, { flush: 'sync' })
// Progress only moves the CSS playhead; static peaks/ruler redraw on viewport or theme changes.
watch([waveform, viewport, width], scheduleDraw)
onMounted(() => {
  width.value = plot.value.getBoundingClientRect().width
  resizeObserver = new ResizeObserver(() => {
    width.value = plot.value.getBoundingClientRect().width
    scheduleDraw()
  })
  resizeObserver.observe(plot.value)
  themeObserver = new MutationObserver(scheduleDraw)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  window.addEventListener('resize', scheduleDraw)
  scheduleDraw()
})
onUnmounted(() => {
  disposed = true
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  window.removeEventListener('resize', scheduleDraw)
})
</script>

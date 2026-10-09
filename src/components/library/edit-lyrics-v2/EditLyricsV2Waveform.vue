<template>
  <section
    class="min-w-0 border-t border-neutral-200 px-3 pb-2 pt-1 dark:border-neutral-700"
    aria-label="Audio waveform"
    data-testid="editor-waveform"
    @keydown="isolateWaveformKey"
  >
    <div
      class="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400"
    >
      <span class="min-w-0 truncate tabular-nums" data-testid="waveform-window">
        {{
          waveform
            ? `${formatTime(viewport.start)} - ${formatTime(viewport.start + viewport.span)}`
            : 'Waveform'
        }}
      </span>
      <output
        v-tooltip="editorTooltip('Playhead position: minutes, seconds and milliseconds')"
        class="min-w-[9ch] font-mono tabular-nums text-neutral-900 dark:text-neutral-100"
        aria-label="Playback position"
        data-testid="waveform-playback-time"
        >{{
          formatMarkerTime(
            Number.isFinite(displayProgress) ? Math.round(displayProgress * 1000) : null
          )
        }}</output
      >
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        <template v-if="hasDraft">
          <span class="tabular-nums" data-testid="waveform-marker-preview">
            {{ formatMarkerTime(previewTimes.startMs) }} -
            {{ formatMarkerTime(previewTimes.endMs) }}
          </span>
          <button
            v-tooltip="
              editorTooltip('Confirm the previewed start/end markers as one undoable timing edit')
            "
            class="button h-7 rounded bg-hoa-1500 px-2 text-white hover:bg-hoa-1400 dark:bg-hoa-1500 dark:text-white dark:hover:bg-hoa-1400"
            :disabled="!!drag"
            data-testid="waveform-apply-markers"
            @click="applyMarkers"
          >
            Apply Markers
          </button>
          <button
            v-tooltip="editorTooltip('Discard the marker preview and keep saved timestamps')"
            class="button button-normal h-7 rounded px-2"
            :disabled="!!drag"
            data-testid="waveform-cancel-markers"
            @click="cancelDraft"
          >
            Cancel
          </button>
        </template>
        <button
          v-tooltip="editorTooltip('Follow the moving playhead; manual scrolling pauses following')"
          class="button button-normal h-7 w-7 rounded"
          aria-label="Follow waveform playback"
          title="Follow waveform playback"
          :aria-pressed="follow"
          :disabled="!waveform"
          :class="follow ? 'ring-1 ring-inset ring-neutral-400 dark:ring-neutral-500' : ''"
          @click="toggleFollow"
        >
          <Follow />
        </button>
        <button
          v-tooltip="editorTooltip('Zoom out to see more of the recording')"
          class="button button-normal h-7 w-7 rounded"
          aria-label="Zoom out waveform"
          title="Zoom out waveform"
          :disabled="!waveform || viewport.span >= waveform.duration"
          @click="zoom(2)"
        >
          <MagnifyMinus />
        </button>
        <button
          v-tooltip="
            editorTooltip('Zoom in around the selected phrase or playhead for precise editing')
          "
          class="button button-normal h-7 w-7 rounded"
          aria-label="Zoom in waveform"
          title="Zoom in waveform"
          :disabled="!waveform || viewport.span <= minimumSpan"
          @click="zoom(0.5)"
        >
          <MagnifyPlus />
        </button>
        <button
          v-tooltip="editorTooltip('Show the entire recording without changing timestamps')"
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
    <div ref="plot" class="relative h-[110px] min-w-0" @wheel="panAtWheel">
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
        title="Click to seek; double-click to zoom at this point"
        aria-valuemin="0"
        :aria-valuemax="waveform.duration"
        :aria-valuenow="cursorTime"
        :aria-valuetext="formatTime(cursorTime)"
        data-testid="waveform-seek"
        @click="seekAtPointer"
        @dblclick.stop.prevent="zoomAtPointer"
        @keydown="seekAtKey"
      >
        <span
          v-if="playheadVisible"
          class="pointer-events-none absolute top-0 h-full w-px bg-hoa-600 dark:bg-hoa-400"
          :style="{ left: `${playheadPercent}%` }"
          data-testid="waveform-playhead"
        />
      </div>
      <button
        v-for="marker in markers"
        :key="marker.boundary"
        v-tooltip="editorTooltip(markerTitle(marker))"
        class="absolute z-10 h-[45px] w-4 -translate-x-1/2 touch-none text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 dark:text-white dark:focus-visible:outline-neutral-100"
        :style="{ left: `${marker.percent}%`, top: marker.boundary === 'start' ? '0' : '45px' }"
        role="slider"
        :aria-label="`Selected lyric ${marker.boundary}`"
        :title="markerTitle(marker)"
        :aria-valuemin="marker.min"
        :aria-valuemax="marker.max"
        :aria-valuenow="marker.time"
        :aria-valuetext="formatMarkerTime(marker.time)"
        :data-testid="`waveform-marker-${marker.boundary}`"
        @click.stop
        @pointerdown="startMarkerDrag(marker, $event)"
        @pointermove="moveMarkerDrag"
        @pointerup="finishMarkerDrag"
        @pointercancel="cancelMarkerDrag"
        @lostpointercapture="cancelMarkerDrag"
        @keydown="markerKey(marker, $event)"
      >
        <!-- Split hit areas keep close start/end handles independently reachable. -->
        <span
          class="pointer-events-none absolute left-1/2 h-[90px] border-l border-neutral-700 dark:border-neutral-300"
          :style="{ top: marker.boundary === 'start' ? '0' : '-45px' }"
        />
        <span
          class="absolute left-0 h-4 w-full rounded-sm bg-neutral-800 text-center text-[10px] font-bold text-white dark:bg-neutral-200 dark:text-neutral-900"
          :class="marker.boundary === 'start' ? 'top-0' : 'bottom-0'"
          >{{ marker.boundary === 'start' ? '[' : ']' }}</span
        >
        <span
          v-if="drag?.boundary === marker.boundary"
          class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 bg-neutral-100 px-1 text-xs dark:bg-neutral-800"
          >{{ formatMarkerTime(marker.time) }}</span
        >
      </button>
      <div
        v-if="!waveform"
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
import { vTooltip, editorTooltip } from '@/utils/editor-tooltip.js'
import MagnifyMinus from '~icons/mdi/magnify-minus-outline'
import MagnifyPlus from '~icons/mdi/magnify-plus-outline'
import Fit from '~icons/mdi/fit-to-screen-outline'
import Follow from '~icons/mdi/crosshairs-gps'
import { formatTimestampMs as formatMarkerTime } from '@/utils/lyricsfile.js'
import {
  globalShortcutBindings,
  syncedEditorShortcutBindings,
  wordTimingShortcutBindings,
} from '@/composables/edit-lyrics-v2/shortcutRegistry.js'
import { waveformMarkerBounds } from '@/utils/waveform-markers.js'
import { useAudioWaveform } from '@/composables/edit-lyrics-v2/useAudioWaveform.js'
import {
  aggregatePeaks,
  followViewport,
  waveformSourceKey,
  clampTime,
  normalizeViewport,
  pixelToTime,
  timeToPixel,
  zoomViewport,
} from '@/utils/waveform-viewport.js'

const props = defineProps({
  audioSource: { type: Object, required: true },
  progress: { type: Number, default: null },
  playing: { type: Boolean, default: false },
  loopRange: { type: Object, default: null },
  selectedLine: { type: Object, default: null },
  selectedLineIndex: { type: Number, default: -1 },
  nextLineStartMs: { type: Number, default: null },
  timingStepMs: { type: Number, default: 100 },
})
const emit = defineEmits(['seek', 'update-markers', 'preview-markers', 'marker-editing-change'])
const isEditorShortcut = event =>
  globalShortcutBindings.some(binding => binding.matches(event)) ||
  event.ctrlKey ||
  event.metaKey ||
  event.altKey
const isolateWaveformKey = event => {
  // Registry overrides and modified shortcuts belong to the editor, not the sliders.
  if (isEditorShortcut(event)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (drag.value) cancelMarkerDrag()
    else cancelDraft()
  }
  if (
    event.defaultPrevented ||
    ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key) ||
    [...syncedEditorShortcutBindings, ...wordTimingShortcutBindings].some(binding =>
      binding.matches(event)
    )
  )
    event.stopPropagation()
}
const { waveform, loading, error, retry } = useAudioWaveform(toRef(props, 'audioSource'))
const viewport = ref({ start: 0, span: 0 })
const canvas = ref(null)
const plot = ref(null)
const width = ref(0)
const follow = ref(true)
let resumeFollowOnPlay = false
const toggleFollow = () => {
  resumeFollowOnPlay = false
  follow.value = !follow.value
}
const drag = ref(null)
const draft = ref(null)
watch([drag, draft], () => emit('marker-editing-change', !!drag.value || !!draft.value), {
  flush: 'sync',
})
const markerEnd = computed(
  () => props.selectedLine?.end_ms ?? props.nextLineStartMs ?? waveform.value?.duration * 1000
)
const markerTitle = marker => {
  const label =
    marker.boundary === 'start'
      ? 'Start (shifts words; end stays fixed)'
      : Number.isFinite(props.selectedLine?.end_ms)
        ? 'End (start stays fixed)'
        : 'Inferred end (next lyric or recording end; set end to confirm)'
  return `${label}: ${formatMarkerTime(marker.time)}. Drag or nudge to preview; Apply Markers confirms.`
}
const previewTimes = computed(() => {
  const times = draft.value || {
    startMs: props.selectedLine?.start_ms,
    endMs: markerEnd.value,
  }
  return drag.value
    ? { ...times, [drag.value.boundary === 'start' ? 'startMs' : 'endMs']: drag.value.timeMs }
    : times
})
const hasDraft = computed(
  () =>
    !!waveform.value &&
    !!props.selectedLine &&
    (previewTimes.value.startMs !== props.selectedLine?.start_ms ||
      previewTimes.value.endMs !== markerEnd.value)
)
const boundsForTimes = times => {
  if (!waveform.value || !props.selectedLine) return null
  const offset = times.startMs - props.selectedLine.start_ms
  // Validate translated words against the fixed draft end without touching the document.
  const line = {
    ...props.selectedLine,
    start_ms: times.startMs,
    end_ms: times.endMs,
    words: Array.isArray(props.selectedLine.words)
      ? props.selectedLine.words.map(word =>
          word
            ? {
                ...word,
                ...(Number.isFinite(word.start_ms) ? { start_ms: word.start_ms + offset } : {}),
                ...(Number.isFinite(word.end_ms) ? { end_ms: word.end_ms + offset } : {}),
              }
            : word
        )
      : props.selectedLine.words,
  }
  return waveformMarkerBounds(line, times.endMs, waveform.value.duration * 1000)
}
const markerBounds = computed(() => boundsForTimes(previewTimes.value))
// Publish released/nudged previews for auditioning without modifying saved lyrics.
watch(
  draft,
  times => {
    emit(
      'preview-markers',
      times && boundsForTimes(times)
        ? {
            ...times,
            line: props.selectedLine,
            lineIndex: props.selectedLineIndex,
          }
        : null
    )
  },
  { flush: 'sync' }
)
const markers = computed(() => {
  if (!markerBounds.value) return []
  return ['start', 'end']
    .map(boundary => {
      const time = previewTimes.value[boundary === 'start' ? 'startMs' : 'endMs']
      return {
        boundary,
        time,
        ...markerBounds.value[boundary],
        percent: timeToPixel(time / 1000, viewport.value, 100),
      }
    })
    .filter(
      marker =>
        drag.value?.boundary === marker.boundary || (marker.percent >= 0 && marker.percent <= 100)
    )
    .map(marker => ({ ...marker, percent: Math.max(0, Math.min(100, marker.percent)) }))
})
let captureTarget
const cancelMarkerDrag = event => {
  if (event?.pointerId != null && event.pointerId !== drag.value?.pointerId) return
  const pointerId = drag.value?.pointerId
  drag.value = null
  if (captureTarget?.hasPointerCapture?.(pointerId)) captureTarget.releasePointerCapture(pointerId)
  captureTarget = null
}
const stageMarker = (boundary, timeMs) => {
  const times = { ...previewTimes.value, [boundary === 'start' ? 'startMs' : 'endMs']: timeMs }
  if (boundsForTimes(times)) draft.value = times
}
const cancelDraft = () => {
  if (drag.value) return
  draft.value = null
}
const discardMarkers = () => {
  cancelMarkerDrag()
  draft.value = null
}
const applyMarkers = () => {
  if (drag.value || !hasDraft.value || !boundsForTimes(previewTimes.value)) return
  const times = { ...previewTimes.value }
  draft.value = null
  emit('update-markers', {
    lineIndex: props.selectedLineIndex,
    line: props.selectedLine,
    ...times,
    durationMs: waveform.value.duration * 1000,
  })
}
const startMarkerDrag = (marker, event) => {
  if (event.button !== 0 || drag.value) return
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.focus?.()
  const bounds = plot.value.getBoundingClientRect()
  // Freeze the mapping during a drag; playback paging resumes after release/cancel.
  drag.value = {
    boundary: marker.boundary,
    timeMs: marker.time,
    initial: marker.time,
    pointerId: event.pointerId,
    initialX: event.clientX,
    bounds,
    viewport: { ...viewport.value },
    min: marker.min,
    max: marker.max,
  }
  captureTarget = event.currentTarget
  captureTarget.setPointerCapture(event.pointerId)
}
const moveMarkerDrag = event => {
  const current = drag.value
  if (!current || event.pointerId !== current.pointerId || !Number.isFinite(event.clientX)) return
  if (!current.bounds.width) return
  // Use displacement so grabbing either edge of the handle does not jump its timestamp.
  const time = Math.round(
    current.initial +
      ((event.clientX - current.initialX) / current.bounds.width) * current.viewport.span * 1000
  )
  drag.value = { ...current, timeMs: Math.max(current.min, Math.min(current.max, time)) }
}
const finishMarkerDrag = event => {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return
  moveMarkerDrag(event)
  const current = drag.value
  cancelMarkerDrag()
  if (current.timeMs !== current.initial) stageMarker(current.boundary, current.timeMs)
}
const markerKey = (marker, event) => {
  if (isEditorShortcut(event)) return
  if (drag.value) return
  const step = props.timingStepMs * (event.shiftKey ? 10 : 1)
  const targets = {
    ArrowLeft: marker.time - step,
    ArrowRight: marker.time + step,
    Home: marker.min,
    End: marker.max,
  }
  if (!(event.key in targets)) return
  event.preventDefault()
  stageMarker(marker.boundary, Math.max(marker.min, Math.min(marker.max, targets[event.key])))
}
const minimumSpan = computed(() =>
  Math.min(waveform.value?.duration || 1, Math.max(1, (waveform.value?.secondsPerPeak || 0) * 2))
)
const displayProgress = computed(() => {
  const range = props.loopRange
  if (
    !Number.isFinite(props.progress) ||
    !Number.isFinite(range?.start) ||
    !Number.isFinite(range?.end) ||
    range.end <= range.start
  )
    return props.progress
  // The player reports on a 40ms interval; hold at the boundary while its loop seek arrives.
  return Math.max(range.start, Math.min(range.end, props.progress))
})
const cursorTime = computed(() => clampTime(displayProgress.value, waveform.value?.duration))
const playheadVisible = computed(
  () =>
    Number.isFinite(displayProgress.value) &&
    displayProgress.value >= viewport.value.start &&
    displayProgress.value <= viewport.value.start + viewport.value.span
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
  if (drag.value) return
  viewport.value = normalizeViewport(waveform.value?.duration)
}
const zoom = factor => {
  if (!waveform.value || drag.value) return
  let anchor = props.progress
  if (markerBounds.value) {
    const start = previewTimes.value.startMs / 1000
    const end = previewTimes.value.endMs / 1000
    const visible = time =>
      Number.isFinite(time) &&
      time >= viewport.value.start &&
      time <= viewport.value.start + viewport.value.span
    // Editing focus wins over an unrelated playhead; manual navigation must not be paged away.
    if (!visible(anchor) || anchor < start || anchor > end) {
      if (visible(start)) anchor = start
      else if (visible(end)) anchor = end
      else if (start < viewport.value.start && end > viewport.value.start + viewport.value.span)
        anchor = viewport.value.start + viewport.value.span / 2
      else anchor = start
    }
    // Bring an off-screen selected boundary into view before magnifying it.
    if (anchor < viewport.value.start || anchor > viewport.value.start + viewport.value.span)
      viewport.value = normalizeViewport(
        waveform.value.duration,
        anchor - viewport.value.span / 2,
        viewport.value.span
      )
  }
  viewport.value = zoomViewport(
    waveform.value.duration,
    viewport.value,
    factor,
    anchor,
    minimumSpan.value
  )
}
const pan = start => {
  if (!waveform.value || drag.value) return
  if (follow.value) resumeFollowOnPlay = true
  follow.value = false
  viewport.value = normalizeViewport(waveform.value.duration, start, viewport.value.span)
}
const panAtWheel = event => {
  if (
    !waveform.value ||
    drag.value ||
    viewport.value.span >= waveform.value.duration ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  const bounds = plot.value.getBoundingClientRect()
  const delta = event.deltaX || event.deltaY
  if (!bounds.width || !Number.isFinite(delta) || !delta) return
  // Wheel events use pixels, lines or pages; map all three onto the visible time window.
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.width : 1
  event.preventDefault()
  pan(viewport.value.start + ((delta * scale) / bounds.width) * viewport.value.span)
}
const pointerTime = event => {
  if (!waveform.value || drag.value || !Number.isFinite(event.clientX)) return null
  const bounds = event.currentTarget.getBoundingClientRect()
  if (!bounds.width) return null
  return pixelToTime(
    event.clientX - bounds.left,
    viewport.value,
    bounds.width,
    waveform.value.duration
  )
}
const zoomAtPointer = event => {
  const anchor = pointerTime(event)
  if (anchor === null) return
  // Hold the inspected region during playback, just like manual panning.
  if (follow.value) resumeFollowOnPlay = true
  follow.value = false
  viewport.value = zoomViewport(
    waveform.value.duration,
    viewport.value,
    0.5,
    anchor,
    minimumSpan.value
  )
}
const seekAtPointer = event => {
  const time = pointerTime(event)
  if (time !== null) emit('seek', time)
}
const seekAtKey = event => {
  if (isEditorShortcut(event)) return
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

watch(
  waveform,
  () => {
    discardMarkers()
    fit()
  },
  { flush: 'sync' }
)
watch(
  [
    () => waveformSourceKey(props.audioSource),
    () => props.selectedLine,
    () => props.selectedLine?.start_ms,
    () => props.selectedLine?.end_ms,
    () => props.selectedLineIndex,
    () => props.nextLineStartMs,
  ],
  discardMarkers,
  // Clear drafts before rendering, not during a nested document change notification.
  { flush: 'pre' }
)
watch(() => props.selectedLine, discardMarkers, { deep: true, flush: 'pre' })
watch([() => props.selectedLineIndex, () => props.selectedLine?.start_ms], () => {
  if (!waveform.value || drag.value || draft.value || !markerBounds.value) return
  const start = props.selectedLine.start_ms / 1000
  if (start < viewport.value.start || start > viewport.value.start + viewport.value.span)
    viewport.value = normalizeViewport(
      waveform.value.duration,
      start - viewport.value.span * 0.15,
      viewport.value.span
    )
})
watch(
  () => props.playing,
  (playing, previous) => {
    // Manual inspection yields when playback restarts; an explicit Follow-off choice does not.
    if (playing && !previous && resumeFollowOnPlay) {
      resumeFollowOnPlay = false
      follow.value = true
    }
  }
)
watch([displayProgress, () => props.playing, follow, drag], () => {
  if (follow.value && props.playing && !drag.value && waveform.value)
    viewport.value = followViewport(waveform.value.duration, viewport.value, displayProgress.value)
})
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
  discardMarkers()
  disposed = true
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  window.removeEventListener('resize', scheduleDraw)
})
</script>

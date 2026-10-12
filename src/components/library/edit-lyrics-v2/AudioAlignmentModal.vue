<template>
  <BaseModal
    :model-value="true"
    :title="sentenceMode ? 'Automatic sentence alignment' : 'Automatic word alignment'"
    content-class="w-full max-w-3xl h-[80vh]"
    :click-to-close="false"
    :esc-to-close="false"
    @keydown.stop="guardKeys"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-3 h-full text-sm text-neutral-800 dark:text-neutral-200">
      <p>
        Basic editing and estimated ELRC timing need no AI. This optional mode uses your local audio
        and a Whisper model. Optional packages and uncached models are downloaded only after your
        approval. Review singing alignment before applying.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <label
          >Language
          <input
            v-model="language"
            :disabled="running"
            class="input w-20"
            aria-label="Alignment language"
            placeholder="en"
        /></label>
        <label
          >Model
          <select
            v-model="model"
            :disabled="running"
            class="select [color-scheme:light] dark:[color-scheme:dark]"
            aria-label="Alignment model"
          >
            <option value="tiny">Tiny</option>
            <option value="base">Base</option>
            <option value="small">Small</option>
          </select></label
        >
        <label v-if="!sentenceMode" class="flex items-center gap-2"
          ><input v-model="replace" type="checkbox" :disabled="running || !!result" /> Replace
          existing word timing</label
        >
      </div>
      <p v-if="sentenceMode" class="text-xs">
        Find sentence starts and ends from the whole recording. Lyrics and blank gap cues are
        preserved. Existing word timing shifts with its sentence; conflicting rows are skipped.
        Review the preview before replacing existing sentence timestamps.
      </p>
      <p v-else class="text-xs">
        Unchecked preserves every existing word timestamp, including accepted estimates. Sentence
        timestamps and lyric text are preserved. TXT without timing can receive automatic sentence
        timing.
      </p>
      <div v-if="available === false" class="flex flex-wrap items-center gap-2">
        <span>Optional engine unavailable. Basic editing still works.</span>
        <button
          class="button button-normal rounded px-3 py-1"
          :disabled="running"
          @click="consent = 'install'"
        >
          Install automatic alignment
        </button>
      </div>
      <div
        v-if="available && modelStatus?.ready === false"
        class="flex flex-wrap items-center gap-2"
      >
        <span>{{ model }} model needs a verified download (about {{ modelMB }} MB).</span>
        <button
          class="button button-normal rounded px-3 py-1"
          :disabled="running"
          @click="consent = 'download'"
        >
          Download selected model
        </button>
      </div>
      <div
        v-if="consent"
        role="region"
        aria-label="Optional download consent"
        class="rounded border border-neutral-400 dark:border-neutral-600 p-3 bg-neutral-100 dark:bg-neutral-800"
      >
        <p v-if="consent === 'install'">
          Install optional Whisper, stable-ts and PyTorch in a private LRCGET environment? Budget
          roughly 1–2 GB of downloads and at least 4 GiB free disk space; existing compatible
          packages may reduce this. Packages come from PyPI and the official PyTorch CPU index.
          Python 3.10–3.12, venv and ffmpeg must be installed first. This setup does not install
          system packages or change your music. Model downloads require separate approval.
        </p>
        <p v-else>
          Download the {{ model }} Whisper model from its official provider? About {{ modelMB }} MB
          will be downloaded and stored in your Whisper cache, with a checksum check. Allow
          {{ modelMB + 105 }} MB free disk space. Your audio and lyrics stay local.
        </p>
        <div class="flex gap-2 mt-2">
          <button class="button button-primary rounded px-3 py-1" @click="setup(consent)">
            Yes, {{ consent === 'install' ? 'install' : 'download' }}
          </button>
          <button class="button button-normal rounded px-3 py-1" @click="consent = null">
            Not now
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="button button-primary rounded px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="running || available !== true || modelStatus?.ready !== true || !!consent"
          @click="run"
        >
          Align using audio
        </button>
        <button v-if="running" class="button button-normal rounded px-3 py-1" @click="cancel">
          Cancel operation
        </button>
        <span role="status">{{ message }}</span>
      </div>
      <progress
        v-if="running"
        :value="percent"
        max="100"
        class="w-full"
        aria-label="Audio alignment progress"
      />
      <p v-if="error" role="alert" class="text-red-700 dark:text-red-300">{{ error }}</p>
      <template v-if="plan">
        <p>
          {{ sentenceMode ? plan.changedSentences : plan.changedWords }}
          {{ sentenceMode ? 'sentence ranges' : 'word timings' }} proposed.
          {{ skippedCount }} sentence{{ skippedCount === 1 ? '' : 's' }} skipped;
          {{ reviewCount }} sentence{{ reviewCount === 1 ? '' : 's' }}
          {{ reviewCount === 1 ? 'needs' : 'need' }} listening review. Nothing is saved until you
          apply and Save.
        </p>
        <p v-if="plan.review.some(item => item.skipped)" class="text-xs">
          Skipped sentences keep their original timing. Correct them manually<span
            v-if="!sentenceMode"
          >
            or approve estimates when saving ELRC</span
          >.
        </p>
        <div class="flex gap-3 min-h-0 grow">
          <div
            class="w-2/5 overflow-auto border border-neutral-300 dark:border-neutral-700 rounded"
          >
            <button
              v-for="(line, i) in plan.lines"
              :key="i"
              class="block w-full text-left px-2 py-1"
              :class="[
                selected === i ? 'bg-neutral-200 dark:bg-neutral-700' : '',
                warning(i) ? 'text-amber-800 dark:text-yellow-300' : '',
              ]"
              @click="selected = i"
            >
              {{ i + 1 }}. {{ line.text || '(gap)' }}
              <span v-if="warning(i)"> — {{ warning(i).reason }}</span>
            </button>
          </div>
          <div class="w-3/5 overflow-auto">
            <button
              class="button button-normal rounded px-2 py-1 mb-2"
              :disabled="!Number.isFinite(current?.start_ms) || loopEnabled"
              @click="emit('listen', current.start_ms / 1000)"
            >
              Listen to sentence
            </button>
            <button class="button button-normal rounded px-2 py-1 ml-2" @click="emit('pause')">
              Pause
            </button>
            <button
              v-if="loopEnabled"
              class="button button-normal rounded px-2 py-1 mb-2"
              @click="emit('stop-loop')"
            >
              Turn off existing loop for preview
            </button>
            <p v-if="sentenceMode" class="mb-2 tabular-nums">
              Sentence: {{ formatTimestampMs(current?.start_ms) }}–{{
                formatTimestampMs(current?.end_ms)
              }}
              <span
                v-if="snapshot?.document.synced[selected]?.start_ms != null"
                class="block text-xs"
              >
                Previous: {{ formatTimestampMs(snapshot.document.synced[selected].start_ms) }}–{{
                  formatTimestampMs(snapshot.document.synced[selected].end_ms)
                }}
              </span>
            </p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(word, i) in current?.words"
                :key="i"
                class="rounded p-1 border border-neutral-300 dark:border-neutral-600"
                :class="[
                  activeWordIndex(current, progressMs) === i ? 'bg-pink-100 dark:bg-pink-900' : '',
                  warning(selected)?.words?.includes(i)
                    ? 'text-amber-800 dark:text-yellow-300'
                    : '',
                ]"
              >
                {{ word.text }}
                <small class="block tabular-nums"
                  >{{ formatTimestampMs(word.start_ms) }}–{{
                    formatTimestampMs(word.end_ms)
                  }}</small
                >
              </span>
            </div>
          </div>
        </div>
        <label v-if="sentenceMode && plan.replacedSentences" class="flex items-start gap-2">
          <input v-model="confirmSentenceReplacement" type="checkbox" class="mt-1" />
          Replace existing sentence timing for {{ plan.replacedSentences }} sentence(s) with this
          preview.
        </label>
      </template>
    </div>
    <template #footer>
      <button class="button button-normal rounded px-4 py-2" @click="emit('close')">Cancel</button>
      <button
        class="button button-primary rounded px-4 py-2 ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!canApply"
        @click="apply"
      >
        Apply preview
      </button>
    </template>
  </BaseModal>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import BaseModal from '@/components/common/BaseModal.vue'
import { mergeAudioAlignment, mergeSentenceAlignment } from '@/utils/audio-alignment.js'
import { formatTimestampMs } from '@/utils/lyricsfile.js'
import { activeWordIndex } from '@/utils/word-playback.js'
const props = defineProps({
  mode: { type: String, default: 'words' },
  getSnapshot: { type: Function, required: true },
  applyAlignment: { type: Function, required: true },
  progressMs: { type: Number, default: -1 },
  loopEnabled: { type: Boolean, default: false },
})
const sentenceMode = computed(() => props.mode === 'sentences')
const confirmSentenceReplacement = ref(false)
const canApply = computed(
  () =>
    !!(sentenceMode.value ? plan.value?.changedSentences : plan.value?.changedWords) &&
    !running.value &&
    !consent.value &&
    (!sentenceMode.value || !plan.value?.replacedSentences || confirmSentenceReplacement.value)
)
const emit = defineEmits(['close', 'listen', 'applied', 'pause', 'stop-loop'])
const guardKeys = event => {
  if ((event.ctrlKey || event.metaKey) && ['s', 'z', 'y'].includes(event.key.toLowerCase()))
    event.preventDefault()
}
const language = ref('en'),
  model = ref('base'),
  replace = ref(false),
  available = ref(null),
  modelStatus = ref(null),
  consent = ref(null),
  running = ref(false),
  percent = ref(0),
  message = ref('Checking optional engine…'),
  error = ref(''),
  result = ref(null),
  plan = ref(null),
  selected = ref(0)
const modelMB = computed(() =>
  Math.ceil(
    (modelStatus.value?.bytes ||
      { tiny: 75572083, base: 145262807, small: 483617219 }[model.value]) / 1000000
  )
)
let modelCheck = 0
const checkModel = async () => {
  const generation = ++modelCheck
  modelStatus.value = null
  try {
    const status = await invoke('audio_alignment_model_status', { model: model.value })
    if (!disposed && generation === modelCheck) modelStatus.value = status
  } catch (err) {
    if (!disposed && generation === modelCheck) error.value = String(err.message || err)
  }
}
watch(model, () => {
  consent.value = null
  void checkModel()
})
const skippedCount = computed(() => plan.value?.review.filter(item => item.skipped).length || 0)
const reviewCount = computed(() => plan.value?.review.filter(item => !item.skipped).length || 0)
const current = computed(() => plan.value?.lines[selected.value])
const warning = i => plan.value?.review.find(item => item.index === i)
let job = null,
  snapshot = null,
  disposed = false,
  unlisten = null
const cancel = () => {
  const pending = job
  job = null
  running.value = false
  consent.value = null
  message.value = 'Cancelled. Existing lyrics unchanged.'
  if (pending) void invoke('cancel_audio_alignment', { jobId: pending }).catch(() => {})
}
const run = async () => {
  if (
    running.value ||
    disposed ||
    available.value !== true ||
    modelStatus.value?.ready !== true ||
    consent.value
  )
    return
  // A failed retry must never leave an older preview paired with a new snapshot.
  plan.value = null
  result.value = null
  confirmSentenceReplacement.value = false
  selected.value = 0
  snapshot = JSON.parse(JSON.stringify(props.getSnapshot()))
  if (snapshot.pendingMarkers) {
    error.value = 'Apply or cancel pending waveform markers first.'
    return
  }
  const lines = structuredClone(
    snapshot.document.synced.some(line => line.text.trim())
      ? snapshot.document.synced
      : snapshot.document.plain.split(/\r?\n/).map(text => ({ text, words: [] }))
  )
  if (!lines.some(line => line.text.trim())) {
    error.value = 'Import or enter lyrics first.'
    return
  }
  if (!snapshot.source?.file_path) {
    error.value = 'Choose local audio first.'
    return
  }
  const originalLines = structuredClone(lines)
  if (sentenceMode.value) {
    // Reuse the engine's whole-recording TXT path, independent of saved LRC bounds.
    for (const line of lines) {
      delete line.start_ms
      delete line.end_ms
    }
  }
  const id = crypto.randomUUID()
  job = id
  running.value = true
  error.value = ''
  percent.value = 0
  message.value = 'Loading model and audio…'
  try {
    for (const line of lines) {
      if (line.text.trim() && !line.words?.length) {
        const tokens = await invoke('segment_words', { text: line.text })
        if (disposed || job !== id) return
        if (!Array.isArray(tokens) || tokens.join('') !== line.text)
          throw new Error('Could not separate words without changing lyrics.')
        line.words = tokens.map(text => ({ text }))
      }
    }
    const output = await invoke('align_lyrics_audio', {
      jobId: id,
      audioPath: snapshot.source.file_path,
      lines,
      language: language.value.trim(),
      model: model.value,
    })
    if (disposed || job !== id) return
    if (JSON.stringify(props.getSnapshot()) !== JSON.stringify(snapshot))
      throw new Error('Lyrics or audio changed during alignment. Run it again.')
    result.value = output
    const merge = sentenceMode.value ? mergeSentenceAlignment : mergeAudioAlignment
    plan.value = merge(originalLines, output, {
      replace: replace.value,
      preventOverlaps: snapshot.overlap,
    })
    message.value = `Preview ready (${output.device?.toUpperCase() || 'local'}).`
  } catch (err) {
    if (!disposed && job === id) {
      error.value = String(err.message || err)
      message.value = 'Alignment failed. Existing lyrics unchanged.'
    }
  } finally {
    if (job === id) {
      job = null
      running.value = false
    }
  }
}
const setup = async action => {
  if (running.value || disposed || consent.value !== action) return
  consent.value = null
  const id = crypto.randomUUID()
  job = id
  running.value = true
  percent.value = 0
  error.value = ''
  message.value = action === 'install' ? 'Preparing private setup…' : 'Preparing model download…'
  try {
    await invoke('setup_audio_alignment', {
      jobId: id,
      action,
      model: model.value,
      confirmed: true,
    })
    if (disposed || job !== id) return
    available.value = await invoke('audio_alignment_available')
    if (disposed || job !== id) return
    await checkModel()
    if (disposed || job !== id) return
    message.value = available.value
      ? 'Local engine ready.'
      : 'Setup finished but engine is unavailable. Check the setup guide.'
  } catch (err) {
    if (!disposed && job === id) {
      error.value = String(err.message || err)
      message.value = 'Optional setup failed. Basic mode remains available.'
    }
  } finally {
    if (job === id) {
      job = null
      running.value = false
    }
  }
}
const apply = () => {
  if (canApply.value && props.applyAlignment(plan.value.lines, snapshot)) {
    emit('applied')
    emit('close')
  }
}
onMounted(async () => {
  try {
    const cleanup = await listen('audio-alignment-progress', ({ payload }) => {
      if (payload.jobId === job) {
        percent.value = Math.max(0, Math.min(100, Number(payload.percent) || 0))
        message.value = payload.message
      }
    })
    if (disposed) {
      cleanup()
      return
    }
    unlisten = cleanup
  } catch (err) {
    if (disposed) return
    error.value = `Live progress is unavailable: ${String(err.message || err)}. You can still run or cancel the operation.`
  }
  try {
    available.value = await invoke('audio_alignment_available')
    if (disposed) return
    await checkModel()
    if (disposed) return
    if (!available.value && (await invoke('audio_alignment_setup_prompt')) && !disposed)
      consent.value = 'install'
    if (!disposed) message.value = available.value ? 'Local engine ready.' : 'Basic mode available.'
  } catch (err) {
    if (!disposed) {
      available.value = false
      error.value = String(err)
    }
  }
})
onUnmounted(() => {
  disposed = true
  cancel()
  unlisten?.()
})
</script>

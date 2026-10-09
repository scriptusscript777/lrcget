<template>
  <div v-if="!isLoading" class="flex flex-col w-full h-screen">
    <LibraryHeader
      :active-tab="activeTab"
      @change-active-tab="changeActiveTab"
      @show-config="openConfigModal"
      @show-about="openAboutModal"
      @show-download-viewer="openDownloadViewer"
      @refresh-library="refreshLibrary"
      @uninitialize-library="$emit('uninitializeLibrary')"
      @manage-directories="$emit('manageDirectories')"
      @export-all-lyrics="handleExportAllLyrics"
      @show-export-viewer="openExportViewer"
    />

    <div id="library-content" class="relative grow overflow-hidden">
      <TrackList :is-active="activeTab === 'tracks'" />

      <AlbumList ref="albumListRef" :is-active="activeTab === 'albums'" />

      <ArtistList ref="artistListRef" :is-active="activeTab === 'artists'" />

      <MyLrclib :is-active="activeTab === 'my-lrclib'" />
    </div>

    <DownloadOptionsPopup
      v-if="downloadRequest"
      :key="downloadRequest.token"
      :session="downloadRequest"
    />
    <NowPlaying class="flex-none" />
  </div>

  <div v-else class="flex flex-col justify-center items-center w-full h-full">
    <div class="animate-spin text-xl text-neutral-800">
      <Loading />
    </div>
    <div v-if="isScanning" class="flex flex-col items-center justify-center text-sm text-neutral-500">
      <div>Scanning library...</div>
      <div v-if="scanProgress" class="mt-1 font-medium">
        {{ scanProgress.message }}
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center text-sm text-neutral-500">
      <div>Loading library...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import Loading from '~icons/mdi/loading'
import _ from 'lodash'
import LibraryHeader from './library/LibraryHeader.vue'
import DownloadOptionsPopup from './library/DownloadOptionsPopup.vue'
import { useDownloadOptions } from '@/composables/download-options.js'

import NowPlaying from './NowPlaying.vue'
import TrackList from './library/TrackList.vue'
import AlbumList from './library/AlbumList.vue'
import ArtistList from './library/ArtistList.vue'
import MyLrclib from './library/MyLrclib.vue'
import DownloadViewer from './library/DownloadViewer.vue'
import ExportViewer from './library/ExportViewer.vue'
import Config from './library/Config.vue'
import About from './About.vue'
import { useToast } from 'vue-toastification'
import { useModal, useVfm } from 'vue-final-modal'
import { useExporter } from '@/composables/export.js'
import { useLibraryNavigation } from '@/composables/library-navigation.js'
import { createLibraryRefreshHandler } from '@/utils/library-refresh.js'

const { request: downloadRequest } = useDownloadOptions()

const props = defineProps({
  shouldScan: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['uninitializeLibrary', 'scanComplete', 'manageDirectories'])

const toast = useToast()
const vfm = useVfm()

const isLoading = ref(true)
const isScanning = ref(false)
const scanProgress = ref(null)
const scanResult = ref(null)
const activeTab = ref('tracks')
const albumListRef = ref(null)
const artistListRef = ref(null)
let unlistenScanProgress = null
let unlistenScanComplete = null
let disposed = false

const { open: openAboutModal, close: closeAboutModal } = useModal({
  component: About,
  attrs: {
    onClose() {
      closeAboutModal()
    },
  },
})

const { open: openConfigModal, close: closeConfigModal } = useModal({
  component: Config,
  attrs: {
    onClose() {
      closeConfigModal()
    },
    onRefreshLibrary() {
      refreshLibrary()
    },
    onFullScanLibrary() {
      fullScanLibrary()
    },
    onManageDirectories() {
      emit('manageDirectories')
    },
  },
})

const { open: openDownloadViewer, close: closeDownloadViewer } = useModal({
  component: DownloadViewer,
  attrs: {
    onClose() {
      closeDownloadViewer()
    },
  },
})

const { open: openExportViewer, close: closeExportViewer } = useModal({
  component: ExportViewer,
  attrs: {
    onClose() {
      closeExportViewer()
    },
  },
})

const {
  addToQueue: addToExportQueue,
} = useExporter()

const { pendingNavigation, clearNavigation } = useLibraryNavigation()

watch(pendingNavigation, async nav => {
  if (!nav) return

  if (nav.type === 'album') {
    activeTab.value = 'albums'
    await nextTick()
    albumListRef.value?.openAlbumById(nav.id)
  } else if (nav.type === 'artist') {
    activeTab.value = 'artists'
    await nextTick()
    artistListRef.value?.openArtistById(nav.id)
  }

  clearNavigation()
})

const changeActiveTab = tab => {
  activeTab.value = tab
}

const handleExportAllLyrics = async formats => {
  try {
    openExportViewer()

    // Get all track IDs that have lyrics
    const trackIds = await invoke('get_track_ids_with_lyrics')

    if (trackIds.length === 0) {
      toast.info('No tracks with lyrics found to export')
      closeExportViewer()
      return
    }

    addToExportQueue(trackIds, formats)
  } catch (error) {
    console.error(error)
    toast.error(`Failed to start export: ${error}`)
    closeExportViewer()
  }
}

const setupScanListeners = async () => {
  // Clean up any existing listeners
  if (unlistenScanProgress) {
    await unlistenScanProgress()
  }
  if (unlistenScanComplete) {
    await unlistenScanComplete()
  }

  // Listen for scan progress updates
  unlistenScanProgress = await listen('scan-progress', event => {
    scanProgress.value = event.payload
  })
  if (disposed) {
    await cleanupScanListeners()
    return false
  }

  // Listen for scan completion
  unlistenScanComplete = await listen('scan-complete', event => {
    scanResult.value = event.payload
    isScanning.value = false
    isLoading.value = false
    emit('scanComplete')
  })
  if (disposed) {
    await cleanupScanListeners()
    return false
  }
  return true
}

const cleanupScanListeners = async () => {
  if (unlistenScanProgress) {
    await unlistenScanProgress()
    unlistenScanProgress = null
  }
  if (unlistenScanComplete) {
    await unlistenScanComplete()
    unlistenScanComplete = null
  }
}

const scanLibrary = async () => {
  if (disposed || isScanning.value) return
  isLoading.value = true
  isScanning.value = true
  scanProgress.value = null
  scanResult.value = null

  try {
    if (!(await setupScanListeners())) return
    // Quick content hashes distinguish files with identical sizes/timestamps.
    // This remains incremental: no full wipe or lyrics export.
    await invoke('scan_library', { useHashDetection: true })
  } catch (error) {
    console.error(error)
    toast.error(`Unknown error happened when scanning the library. Error: ${error}`)
    isScanning.value = false
    isLoading.value = false
    emit('scanComplete')
  }
}

const refreshLibrary = async () => {
  if (vfm.openedModals.length) {
    toast.info('Close the open dialog before refreshing the library. Your edits are unchanged.')
    return
  }
  await scanLibrary()
}

const handleRefreshKey = createLibraryRefreshHandler({
  refresh: refreshLibrary,
  isBusy: () => isScanning.value,
  isBlocked: () => vfm.openedModals.length > 0,
  onBlocked: () => toast.info('Close the open dialog before refreshing the library. Your edits are unchanged.'),
})

const fullScanLibrary = async () => {
  if (disposed || isScanning.value) return
  isLoading.value = true
  isScanning.value = true
  scanProgress.value = null
  scanResult.value = null

  try {
    if (!(await setupScanListeners())) return
    // Full scan with hash detection for accuracy
    await invoke('full_scan_library', { useHashDetection: true })
  } catch (error) {
    console.error(error)
    toast.error(`Unknown error happened when performing full library scan. Error: ${error}`)
    isScanning.value = false
    isLoading.value = false
    emit('scanComplete')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleRefreshKey, true)
  window.addEventListener('keyup', handleRefreshKey, true)
  // Reopening the app must discover changes made while it was closed.
  await scanLibrary()
})

// Watch for changes to shouldScan prop
watch(
  () => props.shouldScan,
  newValue => {
    if (newValue && !isScanning.value) {
      scanLibrary()
    }
  }
)

onUnmounted(async () => {
  disposed = true
  window.removeEventListener('keydown', handleRefreshKey, true)
  window.removeEventListener('keyup', handleRefreshKey, true)
  await cleanupScanListeners()
})
</script>

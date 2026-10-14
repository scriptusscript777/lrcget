import { defineAsyncComponent, ref } from 'vue'
import { useModal } from 'vue-final-modal'

const SearchLyrics = defineAsyncComponent(() => import('@/components/library/SearchLyrics.vue'))

const searchingTrack = ref(null)

export function useSearchLyrics() {
  const searchLyrics = track => {
    searchingTrack.value = track
    openModal()
  }

  const { open: openModal, close: closeModal } = useModal({
    component: SearchLyrics,
    attrs: {
      searchingTrack,
      onClose() {
        closeModal()
      },
      onClosed() {
        searchingTrack.value = null
      },
    },
  })

  return {
    searchingTrack,
    searchLyrics,
  }
}

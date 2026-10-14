import { ref } from 'vue'

const queue = ref([])
const shuffle = ref(false)
const repeatMode = ref('off')

export const setPlayerQueue = trackIds => {
  queue.value = [...new Set(trackIds)]
}

export const getPlayerQueueState = () => ({ queue, shuffle, repeatMode })

export const selectAdjacentTrackId = (
  trackIds,
  currentTrackId,
  { shuffled = false, repeat = 'off', direction = 1, random = Math.random } = {}
) => {
  if (!trackIds.length) return null
  const currentIndex = trackIds.indexOf(currentTrackId)
  if (currentIndex < 0) return null

  if (shuffled && direction > 0 && trackIds.length > 1) {
    const candidates = trackIds.filter(id => id !== currentTrackId)
    return candidates[Math.floor(random() * candidates.length)]
  }

  const nextIndex = currentIndex + direction
  if (nextIndex >= 0 && nextIndex < trackIds.length) return trackIds[nextIndex]
  if (repeat !== 'all') return null
  return trackIds[(nextIndex + trackIds.length) % trackIds.length]
}

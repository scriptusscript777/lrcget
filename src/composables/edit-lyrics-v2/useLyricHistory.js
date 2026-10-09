import { computed, ref, watch } from 'vue'

// Bounded snapshots include word timing; restoring never exports to disk.
export function useLyricHistory(getState, applyState, limit = 100) {
  const past = ref([])
  const future = ref([])
  let current = ''
  let restoring = false
  const snapshot = () => JSON.stringify(getState())

  const clear = () => {
    current = ''
    past.value = []
    future.value = []
  }
  const reset = () => {
    clear()
    current = snapshot()
  }

  watch(
    getState,
    () => {
      if (restoring || !current) return
      const next = snapshot()
      if (next === current) return
      past.value = [...past.value, current].slice(-limit)
      future.value = []
      current = next
    },
    { deep: true, flush: 'sync' }
  )

  const restore = (source, destination) => {
    if (!source.value.length) return
    const next = source.value.at(-1)
    source.value = source.value.slice(0, -1)
    destination.value = [...destination.value, current].slice(-limit)
    restoring = true
    try {
      applyState(JSON.parse(next))
      current = next
    } finally {
      restoring = false
    }
  }

  return {
    clear,
    reset,
    undo: () => restore(past, future),
    redo: () => restore(future, past),
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
  }
}

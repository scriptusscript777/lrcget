import { computed, ref } from 'vue'

const DRAG_THRESHOLD = 3

export function useEditLyricsV2WordBoundaryDrag({
  isWordSyncAvailable,
  words,
  lineStartMs,
  timelineStartMs,
  timelineEndMs,
  selectedLineIndex,
  onUpdateWords,
  onWordTimingEdited,
  onTimingError = () => {},
}) {
  const adjustedBoundary = ref(null)
  let ownUpdate = null
  const dragState = ref(null)
  const selectedBoundaryIndex = ref(0)
  const selectedBoundaryIndices = ref([0])
  const isDraggingBoundary = ref(false)
  const dragStartPos = ref(null)

  const hasAdjustedBoundary = computed(
    () =>
      adjustedBoundary.value &&
      adjustedBoundary.value.index === selectedBoundaryIndex.value &&
      adjustedBoundary.value.lineIndex === selectedLineIndex.value &&
      adjustedBoundary.value.signature === JSON.stringify(words.value)
  )

  const displayedWords = computed(() => {
    const currentWords = words.value

    if (!dragState.value) {
      return currentWords
    }

    return currentWords.map((word, index) => {
      if (index !== dragState.value.rightWordIndex) {
        return word
      }

      return {
        ...word,
        start_ms: dragState.value.currentStartMs,
      }
    })
  })

  const boundaryIndexes = computed(() => {
    if (displayedWords.value.length === 0) {
      return []
    }

    return Array.from({ length: displayedWords.value.length }, (_, index) => index)
  })

  const buildUpdatedWords = (rightWordIndex, startMs) => {
    return words.value.map((word, index) => {
      if (index !== rightWordIndex) {
        return word
      }

      return {
        ...word,
        start_ms: startMs,
      }
    })
  }

  const getBoundaryConstraint = rightWordIndex => {
    const currentWords = words.value
    const word = currentWords[rightWordIndex]
    const previous = currentWords[rightWordIndex - 1]
    const nextStartMs = currentWords[rightWordIndex + 1]?.start_ms
    const minStartMs = Math.max(
      Number.isFinite(timelineStartMs.value) ? timelineStartMs.value : 0,
      previous ? previous.start_ms + 1 : 0,
      Number.isFinite(previous?.end_ms) ? previous.end_ms : 0
    )
    const maxStartMs = Math.min(
      Number.isFinite(nextStartMs) ? nextStartMs - 1 : timelineEndMs.value - 1,
      Number.isFinite(word?.end_ms) ? word.end_ms - 1 : Infinity
    )
    return { minStartMs, maxStartMs }
  }

  const stopBoundaryDrag = () => {
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerCancel)
    document.removeEventListener('pointermove', handlePotentialDragStart)
    document.removeEventListener('pointerup', handlePotentialDragEnd)
    document.removeEventListener('pointercancel', handlePointerCancel)
  }

  const updateDragPosition = (clientX, clientXToTime) => {
    if (!dragState.value) {
      return
    }

    const { minStartMs, maxStartMs } = getBoundaryConstraint(dragState.value.rightWordIndex)
    if (maxStartMs < minStartMs) return
    const nextStartMs = Math.round(clientXToTime(clientX))
    dragState.value = {
      ...dragState.value,
      currentStartMs: Math.max(minStartMs, Math.min(maxStartMs, nextStartMs)),
    }
  }

  const rememberAdjustedBoundary = (index, updatedWords) => {
    adjustedBoundary.value = {
      index,
      lineIndex: selectedLineIndex.value,
      signature: JSON.stringify(updatedWords),
    }
  }

  const consumeOwnWordUpdate = currentWords => {
    const matches =
      ownUpdate?.lineIndex === selectedLineIndex.value &&
      ownUpdate?.signature === JSON.stringify(currentWords)
    ownUpdate = null
    return matches
  }

  const submitWords = updatedWords => {
    const submitted = {
      lineIndex: selectedLineIndex.value,
      signature: JSON.stringify(updatedWords),
    }
    ownUpdate = submitted
    let accepted = false
    onUpdateWords({
      lineIndex: submitted.lineIndex,
      words: updatedWords,
      onResult: result => {
        accepted = result === true
      },
    })
    if (!accepted) {
      ownUpdate = null
      onTimingError('Word timing was not applied; its sentence or overlap bounds changed.')
    }
    return accepted
  }

  const commitBoundary = ({ rightWordIndex, startMs, initialStartMs, shouldReplay }) => {
    if (startMs === initialStartMs) {
      return false
    }

    const updatedWords = buildUpdatedWords(rightWordIndex, startMs)

    if (!submitWords(updatedWords)) return false
    rememberAdjustedBoundary(rightWordIndex, updatedWords)

    if (shouldReplay) {
      onWordTimingEdited({
        lineIndex: selectedLineIndex.value,
        startMs: lineStartMs.value,
      })
    }

    return true
  }

  const normalizeSelection = indices => {
    const maxIndex = Math.max(0, words.value.length - 1)
    const uniqueSorted = [...new Set(indices.filter(Number.isInteger))]
      .filter(index => index >= 0 && index <= maxIndex)
      .sort((a, b) => a - b)

    if (uniqueSorted.length === 0 && words.value.length > 0) {
      return [Math.min(Math.max(selectedBoundaryIndex.value, 0), maxIndex)]
    }

    return uniqueSorted
  }

  const applySelection = (indices, preferredIndex) => {
    const normalized = normalizeSelection(indices)
    selectedBoundaryIndices.value = normalized

    if (normalized.length === 0) {
      selectedBoundaryIndex.value = 0
      return
    }

    if (Number.isInteger(preferredIndex) && normalized.includes(preferredIndex)) {
      selectedBoundaryIndex.value = preferredIndex
      return
    }

    if (normalized.includes(selectedBoundaryIndex.value)) {
      return
    }

    selectedBoundaryIndex.value = normalized[0]
  }

  const handlePointerMove = event => {
    if (event.pointerId !== dragStartPos.value?.pointerId) return
    isDraggingBoundary.value = true
    updateDragPosition(event.clientX, dragStartPos.value.clientXToTime)
  }

  const handlePointerUp = event => {
    if (event.pointerId !== dragStartPos.value?.pointerId) return
    if (dragState.value) {
      commitBoundary({
        rightWordIndex: dragState.value.rightWordIndex,
        startMs: dragState.value.currentStartMs,
        initialStartMs: dragState.value.initialStartMs,
        shouldReplay: true,
      })
    }

    setTimeout(() => {
      isDraggingBoundary.value = false
    }, 0)
    dragState.value = null
    dragStartPos.value = null
    stopBoundaryDrag()
  }

  const handlePotentialDragStart = event => {
    if (!dragStartPos.value || event.pointerId !== dragStartPos.value.pointerId) {
      return
    }

    const dx = Math.abs(event.clientX - dragStartPos.value.x)
    const dy = Math.abs(event.clientY - dragStartPos.value.y)

    if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) {
      return
    }

    isDraggingBoundary.value = true
    dragState.value = {
      rightWordIndex: dragStartPos.value.rightWordIndex,
      initialStartMs: dragStartPos.value.initialStartMs,
      currentStartMs: dragStartPos.value.initialStartMs,
    }

    const clientXToTime = dragStartPos.value.clientXToTime
    dragStartPos.value = {
      clientXToTime,
      pointerId: event.pointerId,
    }

    document.removeEventListener('pointermove', handlePotentialDragStart)
    document.removeEventListener('pointerup', handlePotentialDragEnd)
    document.removeEventListener('pointercancel', handlePointerCancel)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerCancel)

    updateDragPosition(event.clientX, clientXToTime)
  }

  const handlePotentialDragEnd = event => {
    if (event.pointerId !== dragStartPos.value?.pointerId) return
    dragStartPos.value = null
    document.removeEventListener('pointermove', handlePotentialDragStart)
    document.removeEventListener('pointerup', handlePotentialDragEnd)
    document.removeEventListener('pointercancel', handlePointerCancel)
  }

  const startBoundaryDrag = (rightWordIndex, event, clientXToTime) => {
    if (event.button !== 0 || dragStartPos.value || dragState.value) return
    event.preventDefault()
    event.stopPropagation()

    if (!isWordSyncAvailable.value || rightWordIndex < 0 || rightWordIndex >= words.value.length) {
      return
    }

    applySelection([rightWordIndex], rightWordIndex)
    isDraggingBoundary.value = false
    dragStartPos.value = {
      x: event.clientX,
      pointerId: event.pointerId,
      y: event.clientY,
      rightWordIndex,
      initialStartMs: words.value[rightWordIndex].start_ms,
      clientXToTime,
    }

    document.addEventListener('pointermove', handlePotentialDragStart)
    document.addEventListener('pointerup', handlePotentialDragEnd)
    document.addEventListener('pointercancel', handlePointerCancel)
  }

  const selectBoundary = (index, event) => {
    if (!isWordSyncAvailable.value || index < 0 || index >= words.value.length) {
      return
    }

    if (isDraggingBoundary.value) {
      return
    }

    const currentSelection = selectedBoundaryIndices.value

    if (event?.shiftKey && currentSelection.length > 0) {
      const anchor = selectedBoundaryIndex.value
      const min = Math.min(anchor, index)
      const max = Math.max(anchor, index)
      const range = Array.from({ length: max - min + 1 }, (_, offset) => min + offset)
      applySelection(range, index)
      return
    }

    if (event?.ctrlKey || event?.metaKey) {
      const nextSelection = currentSelection.includes(index)
        ? currentSelection.filter(value => value !== index)
        : [...currentSelection, index]
      applySelection(nextSelection, index)
      return
    }

    applySelection([index], index)
  }

  const isBoundarySelected = index => selectedBoundaryIndices.value.includes(index)

  const selectPreviousBoundary = () => {
    if (
      dragStartPos.value ||
      dragState.value ||
      !isWordSyncAvailable.value ||
      words.value.length === 0
    ) {
      return false
    }

    const nextIndex = Math.max(0, selectedBoundaryIndex.value - 1)
    applySelection([nextIndex], nextIndex)
    return true
  }

  const selectNextBoundary = () => {
    if (
      dragStartPos.value ||
      dragState.value ||
      !isWordSyncAvailable.value ||
      words.value.length === 0
    ) {
      return false
    }

    const nextIndex = Math.min(words.value.length - 1, selectedBoundaryIndex.value + 1)
    applySelection([nextIndex], nextIndex)
    return true
  }

  const syncSelectedBoundary = (progressMs, options = {}) => {
    if (
      dragStartPos.value ||
      dragState.value ||
      !isWordSyncAvailable.value ||
      !Number.isFinite(progressMs) ||
      progressMs < 0
    ) {
      return false
    }

    const advance = options.advance !== false

    const rightWordIndex = selectedBoundaryIndex.value
    if (rightWordIndex < 0 || rightWordIndex >= words.value.length) {
      return false
    }

    const adjusted = adjustedBoundary.value
    const keepDraggedTime =
      adjusted &&
      adjusted.index === rightWordIndex &&
      adjusted.lineIndex === selectedLineIndex.value &&
      adjusted.signature === JSON.stringify(words.value)
    adjustedBoundary.value = null
    if (!keepDraggedTime) {
      const { minStartMs, maxStartMs } = getBoundaryConstraint(rightWordIndex)
      const startMs = Math.round(progressMs)
      if (
        !Number.isFinite(minStartMs) ||
        !Number.isFinite(maxStartMs) ||
        maxStartMs < minStartMs ||
        startMs < minStartMs ||
        startMs > maxStartMs
      ) {
        onTimingError(
          'Playback is outside this word’s allowed range. Move its divider or seek within the word before syncing.'
        )
        return false
      }
      const updatedWords = buildUpdatedWords(rightWordIndex, startMs)
      if (!submitWords(updatedWords)) return false
    }

    if (advance && !keepDraggedTime) {
      const nextIndex = rightWordIndex + 1
      if (nextIndex < words.value.length) {
        applySelection([nextIndex], nextIndex)
      }
    }

    return true
  }

  const resetBoundarySelection = () => {
    if (dragStartPos.value || dragState.value) return
    const defaultBoundaryIndex = Math.min(1, Math.max(0, words.value.length - 1))
    applySelection([defaultBoundaryIndex], defaultBoundaryIndex)
  }

  const cancelBoundaryInteraction = () => {
    dragState.value = null
    dragStartPos.value = null
    isDraggingBoundary.value = false
    stopBoundaryDrag()
  }
  const handlePointerCancel = event => {
    if (event.pointerId === dragStartPos.value?.pointerId) cancelBoundaryInteraction()
  }

  return {
    hasAdjustedBoundary,
    rememberAdjustedBoundary,
    consumeOwnWordUpdate,
    dragState,
    dragStartPos,
    displayedWords,
    boundaryIndexes,
    selectedBoundaryIndex,
    selectedBoundaryIndices,
    isDraggingBoundary,
    startBoundaryDrag,
    selectBoundary,
    isBoundarySelected,
    selectPreviousBoundary,
    selectNextBoundary,
    syncSelectedBoundary,
    stopBoundaryDrag,
    resetBoundarySelection,
    cancelBoundaryInteraction,
  }
}

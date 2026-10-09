import { syncedEditorShortcutBindings, wordTimingShortcutBindings } from '@/composables/edit-lyrics-v2/shortcutRegistry.js'

export function useEditLyricsV2SyncedHotkeys({
  wordTimingExpanded,
  undo,
  redo,
  activeTab,
  isSyncedLineEditing,
  selectedLineExists,
  selectedSyncedLineIndex,
  selectedSyncedLineIndices,
  syncedLines,
  progressMs,
  selectSyncedLine,
  clearSyncedLineSelection,
  syncLineToCurrentProgress,
  syncEndToCurrentProgress,
  deleteSyncedLine,
  rewindLineBy100,
  forwardLineBy100,
  rewindEndBy100,
  forwardEndBy100,
  playLineAtOffset,
  playLine,
}) {
  const isKeyboardTargetEditable = event => {
    const element = event.target

    if (!(element instanceof HTMLElement)) {
      return false
    }

    const tag = element.tagName.toLowerCase()
    return element.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
  }

  const hasMultiSelection = () => selectedSyncedLineIndices.value.length >= 2

  const clearSelectionIfNeeded = () => {
    if (hasMultiSelection()) {
      clearSyncedLineSelection()
    }
  }

  const runSyncedAction = actionId => {
    switch (actionId) {
      case 'selectPreviousLine':
        selectSyncedLine(Math.max(0, selectedSyncedLineIndex.value - 1))
        return
      case 'selectNextLine':
        selectSyncedLine(Math.min(syncedLines.value.length - 1, selectedSyncedLineIndex.value + 1))
        return
      case 'syncLineToPlayback':
        syncLineToCurrentProgress(selectedSyncedLineIndex.value)
        return
      case 'syncLineEndToPlayback':
        syncEndToCurrentProgress(selectedSyncedLineIndex.value)
        return
      case 'syncLineEndAndAdvance': {
        const currentLineIndex = selectedSyncedLineIndex.value
        const currentLineEndMs = syncedLines.value[currentLineIndex]?.end_ms
        const currentPlaybackMs = Number(progressMs?.value)
        const isAfterCurrentEnd =
          Number.isFinite(currentLineEndMs) &&
          Number.isFinite(currentPlaybackMs) &&
          currentPlaybackMs > currentLineEndMs

        if (!isAfterCurrentEnd) {
          syncEndToCurrentProgress(currentLineIndex)
        }

        selectSyncedLine(Math.min(syncedLines.value.length - 1, currentLineIndex + 1))
        return
      }
      case 'syncLineAndAdvance': {
        const currentLineIndex = selectedSyncedLineIndex.value
        syncLineToCurrentProgress(currentLineIndex)

        const previousLineIndex = currentLineIndex - 1
        if (previousLineIndex >= 0) {
          syncEndToCurrentProgress(previousLineIndex)
        }

        selectSyncedLine(Math.min(syncedLines.value.length - 1, selectedSyncedLineIndex.value + 1))
        return
      }
      case 'syncLineAndAdvanceNoPreviousEndSync': {
        const currentLineIndex = selectedSyncedLineIndex.value
        syncLineToCurrentProgress(currentLineIndex)
        selectSyncedLine(Math.min(syncedLines.value.length - 1, selectedSyncedLineIndex.value + 1))
        return
      }
      case 'rewindLine':
        rewindLineBy100(selectedSyncedLineIndex.value)
        return
      case 'forwardLine':
        forwardLineBy100(selectedSyncedLineIndex.value)
        return
      case 'rewindLineEnd':
        rewindEndBy100(selectedSyncedLineIndex.value)
        return
      case 'forwardLineEnd':
        forwardEndBy100(selectedSyncedLineIndex.value)
        return
      case 'replayPreviousLine': {
        const previousLineIndex = selectedSyncedLineIndex.value - 1
        if (previousLineIndex < 0) {
          const currentLineStartMs = syncedLines.value[selectedSyncedLineIndex.value]?.start_ms
          const fallbackOffsetMs = Number.isFinite(currentLineStartMs) ? -currentLineStartMs : 0
          playLineAtOffset(selectedSyncedLineIndex.value, fallbackOffsetMs)
          return
        }
        playLineAtOffset(previousLineIndex, 0)
        return
      }
      case 'replaySelectedLine':
        playLine(selectedSyncedLineIndex.value)
        return
      case 'deleteSelectedLine':
        deleteSyncedLine(selectedSyncedLineIndex.value)
        return
    }
  }

  const handleSyncedEditorKeyboardShortcuts = event => {
    if (activeTab.value === 'synced' && !isSyncedLineEditing.value && !isKeyboardTargetEditable(event) && !event.altKey && (event.ctrlKey || event.metaKey)) {
      const key = event.key.toLowerCase()
      if (key === 'z' || (key === 'y' && !event.shiftKey)) {
        event.preventDefault()
        if (key === 'y' || event.shiftKey) redo?.()
        else undo?.()
        return
      }
    }
    if (
      activeTab.value !== 'synced' ||
      isSyncedLineEditing.value ||
      !selectedLineExists.value ||
      isKeyboardTargetEditable(event)
    ) {
      return
    }

    // Expanded word shortcuts take precedence over colliding phrase actions (notably Delete).
    if (wordTimingExpanded?.value && wordTimingShortcutBindings.some(binding => binding.matches(event))) return
    for (const binding of syncedEditorShortcutBindings) {
      if (!binding.matches(event)) {
        continue
      }

      event.preventDefault()
      clearSelectionIfNeeded()
      runSyncedAction(binding.id)
      return
    }
  }

  const bindSyncedHotkeys = () => {
    document.addEventListener('keydown', handleSyncedEditorKeyboardShortcuts)
  }

  const unbindSyncedHotkeys = () => {
    document.removeEventListener('keydown', handleSyncedEditorKeyboardShortcuts)
  }

  return {
    bindSyncedHotkeys,
    unbindSyncedHotkeys,
  }
}

import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useGlobalState } from '@/composables/global-state.js'
import { useEditLyricsV2Document } from './useEditLyricsV2Document.js'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
afterEach(() => useGlobalState().setPreventOverlaps(true))

it('uses the saved preference reactively without editing lyrics when Settings changes', () => {
  const settings = useGlobalState()
  settings.setPreventOverlaps(undefined)
  expect(settings.preventOverlaps.value).toBe(true)
  const scope = effectScope()
  const editor = scope.run(() =>
    useEditLyricsV2Document({
      audioSource: ref({ duration: 10 }),
      lyricsfile: ref(null),
      trackId: ref(1),
      progress: ref(null),
      overlapPreference: settings.preventOverlaps,
      toast: { error: vi.fn() },
    })
  )
  editor.updateSyncedLines([
    { text: 'first', start_ms: 1000, end_ms: 2000 },
    { text: 'second', start_ms: 2000, end_ms: 3000 },
  ])
  const before = JSON.stringify(editor.syncedLines.value)
  expect(editor.syncEndToCurrentProgress(0, 2100)).toBe(false)
  settings.setPreventOverlaps(false)
  expect(editor.preventOverlaps.value).toBe(false)
  expect(JSON.stringify(editor.syncedLines.value)).toBe(before)
  expect(editor.syncEndToCurrentProgress(0, 2100)).toBe(true)
  settings.setPreventOverlaps(true)
  expect(editor.preventOverlaps.value).toBe(true)
  scope.stop()
})

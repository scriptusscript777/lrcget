import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import HeaderActions from './EditLyricsV2HeaderActions.vue'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

const popup = {
  setup(_props, { slots }) {
    return () => h('div', [slots.default?.(), slots.popper?.()])
  },
}

describe('editor export defaults', () => {
  it('selects synced LRC, not plain lyrics or embedding, without exporting or publishing', async () => {
    const app = createSSRApp(HeaderActions, { isDirty: false, isExporting: false })
    app.component('VTooltip', popup)
    app.component('VDropdown', popup)
    app.directive('close-popper', {})
    const html = await renderToString(app)
    const input = id => html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0]
    expect(input('export-synced-lrc')).toContain('checked')
    expect(input('export-plain-text')).not.toContain('checked')
    expect(input('export-enhanced-lrc')).not.toContain('checked')
    expect(input('embed-into-track')).not.toContain('checked')
    const { invoke } = await import('@tauri-apps/api/core')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('loads enabled embedding once and preserves checkbox edits when the menu reopens', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    invoke.mockResolvedValue({ try_embed_lyrics: true, export_embedded: true })
    let state
    const emit = vi.fn()
    await renderToString(
      createSSRApp({
        setup() {
          state = HeaderActions.setup(
            { isDirty: false, isExporting: false },
            { expose: vi.fn(), emit }
          )
          return () => null
        },
      })
    )
    await state.refreshEmbedConfig()
    expect(state.embedIntoTrack.value).toBe(true)
    state.handleExportClick()
    expect(emit).toHaveBeenCalledWith('export', {
      plainText: false,
      syncedLrc: true,
      enhancedLrc: false,
      embedIntoTrack: true,
    })
    state.embedIntoTrack.value = false
    await state.refreshEmbedConfig()
    expect(state.embedIntoTrack.value).toBe(false)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('does not submit embedding when the embedding setting is disabled', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    invoke.mockResolvedValue({ try_embed_lyrics: false, export_embedded: true })
    let state
    const emit = vi.fn()
    await renderToString(
      createSSRApp({
        setup() {
          state = HeaderActions.setup(
            { isDirty: false, isExporting: false },
            { expose: vi.fn(), emit }
          )
          return () => null
        },
      })
    )
    await state.refreshEmbedConfig()
    expect(state.embedIntoTrack.value).toBe(false)
    state.embedIntoTrack.value = true
    state.handleExportClick()
    expect(emit).toHaveBeenCalledWith('export', {
      plainText: false,
      syncedLrc: true,
      enhancedLrc: false,
      embedIntoTrack: false,
    })
    state.exportSyncedLrc.value = false
    expect(state.hasSelectedExportFormat.value).toBe(false)
  })
})

it('remembers ELRC-only selection until the user turns it off', async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  let enabled = false
  invoke.mockImplementation(async (command, args) => {
    if (command === 'set_export_preferences') enabled = args.exportElrc
    return { export_elrc: enabled, try_embed_lyrics: false }
  })
  let state
  const emit = vi.fn()
  await renderToString(
    createSSRApp({
      setup() {
        state = HeaderActions.setup(
          { isDirty: false, isExporting: false },
          { expose: vi.fn(), emit }
        )
        return () => null
      },
    })
  )
  await state.refreshEmbedConfig()
  expect(state.exportEnhancedLrc.value).toBe(false)
  await state.saveEnhancedPreference(true)
  expect(invoke).toHaveBeenCalledWith('set_export_preferences', { exportElrc: true })
  await state.refreshEmbedConfig()
  expect(state.exportEnhancedLrc.value).toBe(true)
  state.exportSyncedLrc.value = false
  expect(state.hasSelectedExportFormat.value).toBe(true)
  state.handleExportClick()
  expect(emit).toHaveBeenCalledWith('export', {
    plainText: false,
    syncedLrc: false,
    enhancedLrc: true,
    embedIntoTrack: false,
  })
  await state.saveEnhancedPreference(false)
  await state.refreshEmbedConfig()
  expect(state.exportEnhancedLrc.value).toBe(false)
})

it('keeps the saved selection when persistence fails and permits retry', async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  invoke.mockResolvedValue({ export_elrc: false })
  let state
  await renderToString(
    createSSRApp({
      setup() {
        state = HeaderActions.setup(
          { isDirty: false, isExporting: false },
          { expose: vi.fn(), emit: vi.fn() }
        )
        return () => null
      },
    })
  )
  await state.refreshEmbedConfig()
  invoke.mockRejectedValueOnce(new Error('write failed'))
  await state.saveEnhancedPreference(true)
  expect(state.exportEnhancedLrc.value).toBe(false)
  expect(state.exportPreferenceError.value).toContain('Could not remember')
  expect(state.isSavingEnhancedPreference.value).toBe(false)
  invoke.mockResolvedValueOnce({ export_elrc: true })
  await state.saveEnhancedPreference(true)
  expect(state.exportEnhancedLrc.value).toBe(true)
  expect(state.exportPreferenceError.value).toBe('')
})

it('blocks export during preference writes and ignores stale configuration reads', async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  invoke.mockResolvedValue({ export_elrc: false })
  let state
  const emit = vi.fn()
  await renderToString(
    createSSRApp({
      setup() {
        state = HeaderActions.setup(
          { isDirty: false, isExporting: false },
          { expose: vi.fn(), emit }
        )
        return () => null
      },
    })
  )
  await state.refreshEmbedConfig()
  let resolveRead, resolveSave
  invoke.mockImplementation(
    command =>
      new Promise(resolve => {
        if (command === 'get_config') resolveRead = resolve
        else resolveSave = resolve
      })
  )
  const read = state.refreshEmbedConfig()
  const save = state.saveEnhancedPreference(true)
  state.handleExportClick()
  expect(emit).not.toHaveBeenCalled()
  resolveSave({ export_elrc: true })
  await save
  resolveRead({ export_elrc: false })
  await read
  expect(state.exportEnhancedLrc.value).toBe(true)
  state.handleExportClick()
  expect(emit).toHaveBeenCalledWith('export', expect.objectContaining({ enhancedLrc: true }))
})

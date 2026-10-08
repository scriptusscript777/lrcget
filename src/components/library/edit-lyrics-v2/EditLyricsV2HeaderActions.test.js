import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import HeaderActions from './EditLyricsV2HeaderActions.vue'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

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
    expect(input('embed-into-track')).not.toContain('checked')
    const { invoke } = await import('@tauri-apps/api/core')
    expect(invoke).not.toHaveBeenCalled()
  })
})

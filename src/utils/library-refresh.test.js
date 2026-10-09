import { describe, expect, it, vi } from 'vitest'
import { createLibraryRefreshHandler } from './library-refresh.js'

const key = (extra = {}) => ({
  key: 'F5',
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...extra,
})

describe('library refresh shortcut', () => {
  const controls = (extra = {}) => ({
    refresh: vi.fn(),
    isBusy: () => false,
    isBlocked: () => false,
    onBlocked: vi.fn(),
    ...extra,
  })

  it('refreshes once and prevents webview reload', () => {
    const state = controls()
    const event = key()
    createLibraryRefreshHandler(state)(event)
    expect(state.refresh).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
  })

  it.each([
    { repeat: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])('does not refresh for held or modified F5: %j', extra => {
    const state = controls()
    const event = key(extra)
    createLibraryRefreshHandler(state)(event)
    expect(state.refresh).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('cannot start a second scan', () => {
    let busy = false
    const state = controls({
      isBusy: () => busy,
      refresh: vi.fn(() => {
        busy = true
      }),
    })
    const handler = createLibraryRefreshHandler(state)
    handler(key())
    handler(key())
    expect(state.refresh).toHaveBeenCalledOnce()
  })

  it('handles key release fallback but not both halves of one press', () => {
    const state = controls()
    const handler = createLibraryRefreshHandler(state)
    handler(key({ type: 'keydown' }))
    handler(key({ type: 'keyup' }))
    expect(state.refresh).toHaveBeenCalledOnce()
    handler(key({ type: 'keyup' }))
    expect(state.refresh).toHaveBeenCalledTimes(2)
  })

  it('recognizes function keys reported only by code', () => {
    const state = controls()
    createLibraryRefreshHandler(state)(key({ key: '', code: 'F5' }))
    expect(state.refresh).toHaveBeenCalledOnce()
  })

  it('protects open dialogs and unsaved editors', () => {
    const state = controls({ isBlocked: () => true })
    createLibraryRefreshHandler(state)(key())
    expect(state.refresh).not.toHaveBeenCalled()
    expect(state.onBlocked).toHaveBeenCalledOnce()
  })

  it('leaves other shortcuts untouched', () => {
    const state = controls()
    const event = key({ key: 'F4' })
    createLibraryRefreshHandler(state)(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(state.refresh).not.toHaveBeenCalled()
  })
})

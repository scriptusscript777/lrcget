import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useNativePlaybackLoop } from './useNativePlaybackLoop.js'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
const scopes = []
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.resetAllMocks()
})
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, ...scope.run(useNativePlaybackLoop) }
}
const source = { type: 'library', id: 7, file_path: '/fixture.mp3' }
describe('native loop ownership', () => {
  it('skips superseded ranges while a session is loading', async () => {
    let ready
    invoke.mockImplementation(command =>
      command === 'begin_playback_loop_session'
        ? new Promise(resolve => (ready = resolve))
        : Promise.resolve(true)
    )
    const { setLoopRange } = setup()
    const first = setLoopRange({ start: 1, end: 2 }, source)
    const latest = setLoopRange({ start: 1.1, end: 1.8 }, source)
    ready(12)
    expect(await first).toBe(false)
    expect(await latest).toBe(true)
    expect(invoke).toHaveBeenLastCalledWith(
      'set_playback_loop',
      expect.objectContaining({ sessionId: 12, revision: 2, start: 1.1, end: 1.8, trackId: 7 })
    )
  })
  it('cancels pending enable on disposal and sends only owned cleanup', async () => {
    let ready
    invoke.mockImplementation(command =>
      command === 'begin_playback_loop_session'
        ? new Promise(resolve => (ready = resolve))
        : Promise.resolve(true)
    )
    const { setLoopRange, scope } = setup()
    const pending = setLoopRange({ start: 1, end: 2 }, source)
    scope.stop()
    ready(3)
    expect(await pending).toBe(false)
    await Promise.resolve()
    expect(invoke).toHaveBeenLastCalledWith(
      'set_playback_loop',
      expect.objectContaining({ sessionId: 3, start: null, end: null })
    )
    expect(await setLoopRange({ start: 3, end: 4 }, source)).toBe(false)
  })
  it('snapshots source and bounds before an asynchronous session request', async () => {
    let ready
    invoke.mockImplementation(command =>
      command === 'begin_playback_loop_session'
        ? new Promise(resolve => (ready = resolve))
        : Promise.resolve(true)
    )
    const { setLoopRange } = setup()
    const target = { type: 'file', file_path: '/original.mp3' }
    const range = { start: 1, end: 2 }
    const pending = setLoopRange(range, target)
    target.file_path = '/changed.mp3'
    range.end = 4
    ready(1)
    await pending
    expect(invoke).toHaveBeenLastCalledWith(
      'set_playback_loop',
      expect.objectContaining({ filePath: '/original.mp3', start: 1, end: 2, trackId: null })
    )
  })
  it('allows retry after a failed session creation', async () => {
    invoke
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(5)
      .mockResolvedValue(true)
    const { setLoopRange } = setup()
    await expect(setLoopRange({ start: 1, end: 2 }, source)).rejects.toThrow('unavailable')
    expect(await setLoopRange({ start: 1, end: 2 }, source)).toBe(true)
  })
})

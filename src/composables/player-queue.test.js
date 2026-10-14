import { describe, expect, it } from 'vitest'
import { selectAdjacentTrackId } from './player-queue.js'

describe('selectAdjacentTrackId', () => {
  const ids = [11, 22, 33]

  it('moves to adjacent tracks and stops at queue ends when repeat is off', () => {
    expect(selectAdjacentTrackId(ids, 22)).toBe(33)
    expect(selectAdjacentTrackId(ids, 11, { direction: -1 })).toBeNull()
    expect(selectAdjacentTrackId(ids, 33)).toBeNull()
  })

  it('wraps at both ends when repeat all is enabled', () => {
    expect(selectAdjacentTrackId(ids, 33, { repeat: 'all' })).toBe(11)
    expect(selectAdjacentTrackId(ids, 11, { direction: -1, repeat: 'all' })).toBe(33)
  })

  it('chooses a different track in shuffle mode', () => {
    expect(selectAdjacentTrackId(ids, 22, { shuffled: true, random: () => 0 })).toBe(11)
    expect(selectAdjacentTrackId([22], 22, { shuffled: true })).toBeNull()
  })

  it('does not navigate when the active track is outside the queue', () => {
    expect(selectAdjacentTrackId(ids, 99)).toBeNull()
    expect(selectAdjacentTrackId([], 99)).toBeNull()
  })
})

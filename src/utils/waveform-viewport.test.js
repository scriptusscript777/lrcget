import { describe, expect, it } from 'vitest'
import {
  aggregatePeaks,
  clampTime,
  isWaveformSourcePlaying,
  normalizeViewport,
  pixelToTime,
  timeToPixel,
  waveformSourceKey,
  zoomViewport,
} from './waveform-viewport.js'

describe('waveform viewport', () => {
  it('clamps invalid times and durations', () => {
    expect(clampTime(NaN, 10)).toBe(0)
    expect(clampTime(-2, 10)).toBe(0)
    expect(clampTime(12, 10)).toBe(10)
    for (const duration of [0, -1, NaN, Infinity]) {
      expect(normalizeViewport(duration, 3, 2)).toEqual({ start: 0, span: 0 })
    }
  })

  it('bounds panning and repairs invalid spans', () => {
    expect(normalizeViewport(100, 95, 20)).toEqual({ start: 80, span: 20 })
    expect(normalizeViewport(100, -5, 20)).toEqual({ start: 0, span: 20 })
    expect(normalizeViewport(100, NaN, NaN)).toEqual({ start: 0, span: 100 })
    expect(normalizeViewport(100, 10, 200)).toEqual({ start: 0, span: 100 })
  })

  it('zooms around the visible cursor or midpoint and bounds the end', () => {
    expect(zoomViewport(100, { start: 20, span: 40 }, 0.5, 30)).toEqual({ start: 25, span: 20 })
    expect(zoomViewport(100, { start: 20, span: 40 }, 0.5, null)).toEqual({ start: 30, span: 20 })
    expect(zoomViewport(100, { start: 20, span: 40 }, 0.5, 90)).toEqual({ start: 30, span: 20 })
    expect(zoomViewport(100, { start: 80, span: 20 }, 2, 100)).toEqual({ start: 60, span: 40 })
    expect(zoomViewport(100, { start: 80, span: 20 }, 100, 100)).toEqual({ start: 0, span: 100 })
    expect(zoomViewport(0.3, { start: 0, span: 0.3 }, 0.5, 0)).toEqual({ start: 0, span: 0.3 })
    expect(zoomViewport(100, { start: 0, span: 2 }, NaN)).toEqual({ start: 0, span: 2 })
  })

  it('maps time and pixels for resized and invalid widths', () => {
    const view = { start: 20, span: 40 }
    expect(timeToPixel(30, view, 400)).toBe(100)
    expect(timeToPixel(30, view, 800)).toBe(200)
    expect(pixelToTime(100, view, 400, 100)).toBe(30)
    expect(pixelToTime(-10, view, 400, 100)).toBe(20)
    expect(pixelToTime(500, view, 400, 100)).toBe(60)
    expect(pixelToTime(1, view, NaN, 100)).toBe(20)
    expect(timeToPixel(30, { start: 0, span: 0 }, 400)).toBe(0)
    expect(pixelToTime(400, { start: 90, span: 20 }, 400, 100)).toBe(100)
  })

  it('retains maximum transients at fit and zoomed scales', () => {
    const peaks = [0.1, 1, 0.2, 0.3, 0.8, 0.1]
    expect(Array.from(aggregatePeaks(peaks, 1, { start: 0, span: 6 }, 2))).toEqual([
      1,
      expect.closeTo(0.8),
    ])
    expect(Array.from(aggregatePeaks(peaks, 1, { start: 1, span: 1 }, 4))).toEqual([1, 1, 1, 1])
    expect(Array.from(aggregatePeaks(peaks, 1, { start: 0.5, span: 1 }, 1))).toEqual([1])
    expect(Array.from(aggregatePeaks(peaks, 0, { start: 0, span: 6 }, 2))).toEqual([0, 0])
    expect(aggregatePeaks(peaks, 1, { start: 0, span: 6 }, NaN).length).toBe(0)
  })

  it('requires an actual matching source, including zero-valued library IDs', () => {
    expect(waveformSourceKey({ type: 'library', id: 0 })).toBe('library:0')
    expect(isWaveformSourcePlaying({ type: 'library', id: 1 }, { id: 2 })).toBe(false)
    expect(isWaveformSourcePlaying({ type: 'file', file_path: '/a' }, { file_path: '/a' })).toBe(
      true
    )
    expect(isWaveformSourcePlaying({ type: 'file' }, {})).toBe(false)
    expect(isWaveformSourcePlaying({ type: 'library', file_path: '/a' }, { file_path: '/b' })).toBe(
      false
    )
  })
})

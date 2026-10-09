import { describe, expect, it } from 'vitest'
import { editorTooltip, vTooltip } from './editor-tooltip.js'

describe('native editor descriptions', () => {
  it('sets and updates only the native description without overlay listeners', () => {
    const attributes = new Map()
    const element = { setAttribute: (name, value) => attributes.set(name, value) }
    vTooltip.mounted(element, { value: editorTooltip('Sync start') })
    expect([...attributes]).toEqual([['title', 'Sync start']])
    vTooltip.updated(element, { value: editorTooltip('Updated start') })
    expect([...attributes]).toEqual([['title', 'Updated start']])
  })

  it('keeps text literal and clears a missing description', () => {
    const attributes = new Map()
    const element = { setAttribute: (name, value) => attributes.set(name, value) }
    vTooltip.mounted(element, { value: editorTooltip('<button>') })
    expect(attributes.get('title')).toBe('<button>')
    vTooltip.updated(element, { value: undefined })
    expect(attributes.get('title')).toBe('')
  })
})

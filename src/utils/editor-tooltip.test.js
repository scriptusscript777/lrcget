import { describe, expect, it } from 'vitest'
import { editorTooltip, vTooltip } from './editor-tooltip.js'

describe('timed editor descriptions', () => {
  it('sets and updates accessible descriptions without native title popups', () => {
    const attributes = new Map()
    const element = {
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name),
    }
    vTooltip.mounted(element, { value: editorTooltip('Sync start') })
    expect(attributes.get('data-editor-help')).toBe('Sync start')
    expect(attributes.get('aria-description')).toBe('Sync start')
    expect(attributes.has('title')).toBe(false)
    vTooltip.updated(element, { value: editorTooltip('Updated start') })
    expect([...attributes]).toEqual([
      ['data-editor-help', 'Updated start'],
      ['aria-description', 'Updated start'],
    ])
  })

  it('keeps text literal and clears a missing description', () => {
    const attributes = new Map()
    const element = {
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name),
    }
    vTooltip.mounted(element, { value: editorTooltip('<button>') })
    expect(attributes.get('data-editor-help')).toBe('<button>')
    vTooltip.updated(element, { value: undefined })
    expect(attributes.get('data-editor-help')).toBe('')
  })
})

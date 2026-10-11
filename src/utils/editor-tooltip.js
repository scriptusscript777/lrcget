// Shared descriptions remain available after the timed visual help closes.
const describeControl = (element, { value }) => {
  const text = value?.content ?? ''
  element.setAttribute('data-editor-help', text)
  element.setAttribute('aria-description', text)
  element.removeAttribute('title')
}

export const vTooltip = { mounted: describeControl, updated: describeControl }
export const editorTooltip = content => ({ content })

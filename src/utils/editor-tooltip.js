// Use native hover descriptions, not focusable/interactive popup panels.
// The browser controls the delay; this directive never creates overlay elements.
const describeControl = (element, { value }) => {
  element.setAttribute('title', value?.content ?? '')
}

export const vTooltip = { mounted: describeControl, updated: describeControl }
export const editorTooltip = content => ({ content })

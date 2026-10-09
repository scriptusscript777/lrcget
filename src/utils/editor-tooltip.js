export { vTooltip } from 'floating-vue'

// Keep editing help consistent with the application's existing themed popovers.
export const editorTooltip = content => ({
  content,
  html: false,
  theme: 'lrcget-tooltip',
  popperClass: 'editor-help',
  triggers: ['hover', 'focus'],
  delay: { show: 350, hide: 0 },
})

// Capture F5 before the webview can reload and discard an unsaved editor.
export function createLibraryRefreshHandler({ refresh, isBusy, isBlocked, onBlocked }) {
  let handledKeyDown = false
  return event => {
    if (event.key !== 'F5' && event.code !== 'F5' && event.keyCode !== 116) return
    event.preventDefault()
    event.stopPropagation()
    // Some desktop webviews consume the function-key press natively but
    // deliver its release. Use that fallback without refreshing twice.
    if (event.type === 'keyup') {
      if (handledKeyDown) {
        handledKeyDown = false
        return
      }
    } else {
      handledKeyDown = true
    }
    if (event.repeat || isBusy()) return
    if (isBlocked()) {
      onBlocked()
      return
    }
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
    return refresh()
  }
}

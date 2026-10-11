import { ref, computed } from 'vue'

const isHotkeyState = ref(true)
const themeModeState = ref(true)
const lrclibInstanceState = ref('')
const showHoverHelpState = ref(false)
const preventLyricOverlapsState = ref(true)

export function useGlobalState() {
  const disableHotkey = () => {
    console.log('disabled hotkey!')
    isHotkeyState.value = false
  }
  const enableHotkey = () => {
    console.log('enabled hotkey!')
    isHotkeyState.value = true
  }
  const isHotkey = computed(() => isHotkeyState.value)

  const setThemeMode = mode => {
    themeModeState.value = mode
  }
  const setLrclibInstance = instance => {
    lrclibInstanceState.value = instance
  }

  const lrclibInstance = computed(() => lrclibInstanceState.value)

  const themeMode = computed(() => themeModeState.value)

  return {
    isHotkey,
    disableHotkey,
    enableHotkey,
    setThemeMode,
    themeMode,
    setLrclibInstance,
    lrclibInstance,
    preventOverlaps: computed(() => preventLyricOverlapsState.value),
    setPreventOverlaps: enabled => {
      preventLyricOverlapsState.value = enabled !== false
    },
    showHoverHelp: computed(() => showHoverHelpState.value),
    setShowHoverHelp: enabled => {
      showHoverHelpState.value = enabled === true
    },
  }
}

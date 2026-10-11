import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Match Tauri's existing LRCGET x64 default, so upgrades retain the same identity.
export const upgradeCode = 'cb2c1039-af2b-5f2d-a756-440c863f9a94'

export function msiVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+local\.(\d+))?$/.exec(version)
  if (!match) throw new Error(`Unsupported release version: ${version}`)
  const [major, minor, patch] = match.slice(1, 4).map(Number)
  const local = Number(match[4] ?? 0)
  // Windows ignores a fourth version field; put the local revision in field three.
  if (major > 255 || minor > 255 || patch > 9 || local > 999) {
    throw new Error(
      'MSI version requires major/minor <=255, decimal patch <=9, local revision <=999'
    )
  }
  return `${major}.${minor}.${patch * 1000 + local}`
}

export function windowsConfig(version) {
  return {
    bundle: {
      windows: {
        wix: { version: msiVersion(version), upgradeCode, language: 'en-US' },
        webviewInstallMode: { type: 'embedBootstrapper' },
      },
    },
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cargo = readFileSync(new URL('../../src-tauri/Cargo.toml', import.meta.url), 'utf8')
  const version = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
  if (!version) throw new Error('Could not read release version from Cargo.toml')
  process.stdout.write(JSON.stringify(windowsConfig(version)))
}

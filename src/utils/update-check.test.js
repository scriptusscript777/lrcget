import { describe, expect, it } from 'vitest'
import {
  fetchLatestRelease,
  isNewerRelease,
  pickInstallerAsset,
  releaseVersion,
} from './update-check.js'

const assets = [
  { name: 'LRCGET_2.2.8_amd64.deb.sha256', url: 'deb-sum' },
  { name: 'LRCGET_2.2.8_amd64.deb', url: 'deb' },
  { name: 'LRCGET_2.2.8_amd64.AppImage', url: 'appimage' },
  { name: 'LRCGET_2.2.8_x64_en-US.msi', url: 'msi' },
  { name: 'LRCGET_2.2.8_x64_en-US.msi.sha256', url: 'msi-sum' },
]

describe('GitHub update check', () => {
  it('reads the main version from release tags', () => {
    expect(releaseVersion('v2.2.7-windows-beta.1')).toBe('2.2.7')
    expect(releaseVersion('v2.3.0')).toBe('2.3.0')
    expect(releaseVersion('not a version')).toBe(null)
  })

  it('alerts only for a higher main version', () => {
    expect(isNewerRelease('v2.2.8', '2.2.7')).toBe(true)
    expect(isNewerRelease('v2.3.0-local.1', '2.2.9')).toBe(true)
    expect(isNewerRelease('v2.2.7-windows-beta.1', '2.2.7')).toBe(false)
    expect(isNewerRelease('v2.2.6', '2.2.7')).toBe(false)
    expect(isNewerRelease('nightly', '2.2.7')).toBe(false)
  })

  it('picks the installer matching the install format and processor', () => {
    const x64 = kind => ({ kind, arch: 'x86_64' })
    expect(pickInstallerAsset(assets, x64('deb')).url).toBe('deb')
    expect(pickInstallerAsset(assets, x64('appimage')).url).toBe('appimage')
    expect(pickInstallerAsset(assets, x64('msi')).url).toBe('msi')
    expect(pickInstallerAsset(assets, x64('other'))).toBe(null)
    expect(pickInstallerAsset([], x64('msi'))).toBe(null)
    expect(pickInstallerAsset(assets)).toBe(null)
  })

  it('never offers an installer built for another processor', () => {
    expect(pickInstallerAsset(assets, { kind: 'deb', arch: 'aarch64' })).toBe(null)
    expect(pickInstallerAsset(assets, { kind: 'msi', arch: 'x86' })).toBe(null)
    const armAssets = [...assets, { name: 'LRCGET_2.2.8_arm64.deb', url: 'arm-deb' }]
    expect(pickInstallerAsset(armAssets, { kind: 'deb', arch: 'aarch64' }).url).toBe('arm-deb')
    expect(pickInstallerAsset(armAssets, { kind: 'deb', arch: 'x86_64' }).url).toBe('deb')
  })

  it('maps the latest GitHub release and rejects failed responses', async () => {
    const release = await fetchLatestRelease(async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v2.2.8',
        name: 'LRCGET 2.2.8',
        html_url: 'https://example.test/release',
        assets: [{ name: 'a.msi', browser_download_url: 'https://example.test/a.msi' }],
      }),
    }))
    expect(release).toEqual({
      tag: 'v2.2.8',
      version: '2.2.8',
      name: 'LRCGET 2.2.8',
      releaseUrl: 'https://example.test/release',
      assets: [{ name: 'a.msi', url: 'https://example.test/a.msi' }],
    })
    await expect(fetchLatestRelease(async () => ({ ok: false, status: 403 }))).rejects.toThrow(
      '403'
    )
  })
})

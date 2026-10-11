import { test } from 'node:test'
import assert from 'node:assert/strict'
import { msiVersion, upgradeCode, windowsConfig } from './msi-config.mjs'

test('local revisions advance an MSI field used by Windows upgrade comparison', () => {
  assert.equal(msiVersion('2.2.6+local.8'), '2.2.6008')
  assert.equal(msiVersion('2.2.6+local.9'), '2.2.6009')
  assert.equal(msiVersion('2.2.7+local.1'), '2.2.7001')
  assert.equal(msiVersion('2.3.0+local.1'), '2.3.1')
  assert.equal(msiVersion('2.2.6'), '2.2.6000')
})
test('unsupported versions fail instead of silently producing an equal or invalid MSI version', () => {
  for (const version of ['2.2.6-beta', '256.2.6', '2.256.6', '2.2.10', '2.2.6+local.1000', 'bad']) {
    assert.throws(() => msiVersion(version))
  }
})
test('upgrade identity is stable and WebView2 bootstrapper is embedded', () => {
  const config = windowsConfig('2.2.6+local.8')
  assert.equal(config.bundle.windows.wix.upgradeCode, upgradeCode)
  assert.equal(config.bundle.windows.wix.language, 'en-US')
  assert.equal(config.bundle.windows.webviewInstallMode.type, 'embedBootstrapper')
})

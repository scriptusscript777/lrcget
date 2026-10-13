import semver from 'semver'

// Releases of this build are published to Rick's fork, not upstream.
export const UPDATE_REPO = 'scriptusscript777/lrcget'
export const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases`
const LATEST_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`

const INSTALLER_PATTERNS = {
  deb: /\.deb$/i,
  appimage: /\.AppImage$/i,
  msi: /\.msi$/i,
}

export const INSTALLER_LABELS = {
  deb: 'Debian package (.deb)',
  appimage: 'AppImage',
  msi: 'Windows installer (.msi)',
}

// Tags such as `v2.2.7-windows-beta.1` or `v2.2.5-local.1` compare by their
// main version only, so rebuilding the same version never raises an alert.
export const releaseVersion = tag => semver.coerce(tag)?.version ?? null

export const isNewerRelease = (tag, currentVersion) => {
  const latest = releaseVersion(tag)
  const current = releaseVersion(currentVersion)
  return Boolean(latest && current && semver.gt(latest, current))
}

// Release file names use packaging names (`amd64`, `x64`); the backend reports
// Rust's `std::env::consts::ARCH` (`x86_64`, `aarch64`).
const ARCH_PATTERNS = {
  x86_64: /(^|[_.-])(amd64|x64|x86_64)([_.-]|$)/i,
  aarch64: /(^|[_.-])(arm64|aarch64)([_.-]|$)/i,
}

// Only an installer of the same format and processor type is offered; anything
// else falls back to the release page so a wrong package is never suggested.
export const pickInstallerAsset = (assets, { kind, arch } = {}) => {
  const formatPattern = INSTALLER_PATTERNS[kind]
  const archPattern = ARCH_PATTERNS[arch]
  if (!formatPattern || !archPattern || !Array.isArray(assets)) return null
  return (
    assets.find(asset => formatPattern.test(asset.name) && archPattern.test(asset.name)) ?? null
  )
}

export const fetchLatestRelease = async (fetchImpl = fetch) => {
  const response = await fetchImpl(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    throw new Error(`GitHub release check failed: ${response.status}`)
  }
  const data = await response.json()
  return {
    tag: data.tag_name,
    version: releaseVersion(data.tag_name),
    name: data.name || data.tag_name,
    releaseUrl: data.html_url || UPDATE_RELEASES_URL,
    assets: (data.assets || []).map(asset => ({
      name: asset.name,
      url: asset.browser_download_url,
    })),
  }
}

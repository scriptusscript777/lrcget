# Windows signing status

The current Windows MSI has no digital publisher signature. Windows cannot
verify its publisher from the MSI, so it may display an unknown-publisher or
SmartScreen warning, and device security settings may prevent installation. This
is a new independent fork with limited public recognition, so it does not yet
qualify for a sponsored signing certificate. The warning alone does not mean the
file is malware.

Install only if you downloaded it from the LRCGET fork's official GitHub release
and its SHA-256 matches the published checksum. The Windows CI workflow checks
package metadata, installation, repair, launch and uninstallation, and its
Microsoft Defender scans have reported no threats. These checks reduce risk but
cannot guarantee a file is risk-free, remove the warning or establish publisher
identity. A checksum verifies that the download matches the published file; it
does not prove who created it.

See [Windows installation](packages.md#windows-x64-msi) and
[privacy and network behavior](privacy.md) for related details.

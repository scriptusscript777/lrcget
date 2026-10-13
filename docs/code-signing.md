# Windows signing status

The current Windows MSI is unsigned. Windows may display an unknown-publisher or
SmartScreen warning, and device security settings may prevent installation.

The Windows build workflow validates package metadata, installation, repair,
launch, uninstallation and available Microsoft Defender scans. Those checks do
not add a digital publisher signature or establish SmartScreen reputation.

See [Windows installation](packages.md#windows-x64-msi-beta) and
[privacy and network behavior](privacy.md) for related details.

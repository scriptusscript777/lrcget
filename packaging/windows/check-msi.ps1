[CmdletBinding()]
param([Parameter(Mandatory)][string]$PackageDirectory, [switch]$RequireSignature, [string]$PreviousPackage)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Installation checks are restricted to a disposable Windows CI runner.'
}
$PackageDirectory = (Resolve-Path $PackageDirectory).Path
$packages = @(Get-ChildItem $PackageDirectory -Filter '*.msi' -File)
if ($packages.Count -ne 1) { throw 'Expected exactly one MSI to test.' }
$package = $packages[0].FullName
$expectedHash = (Get-Content "$package.sha256" -Raw).Split(' ')[0]
if ((Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'MSI checksum does not match.'
}
$config = (& node (Join-Path $PSScriptRoot 'msi-config.mjs') | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'MSI configuration generation failed.' }
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase($package, 0)
$properties = @{}
foreach ($name in @('ProductName', 'ProductVersion', 'Manufacturer', 'UpgradeCode', 'ProductCode')) {
    $view = $database.OpenView("SELECT ``Value`` FROM ``Property`` WHERE ``Property``='$name'")
    try {
        $view.Execute()
        $record = $view.Fetch()
        if ($null -eq $record) { throw "Missing MSI property: $name" }
        $properties[$name] = $record.StringData(1)
    } finally { $view.Close() }
}
$properties | ConvertTo-Json | Set-Content (Join-Path $PackageDirectory 'msi-properties.json')
if ($properties.ProductName -ne 'LRCGET' -or $properties.ProductVersion -ne $config.bundle.windows.wix.version -or
    $properties.UpgradeCode.Trim('{}') -ne $config.bundle.windows.wix.upgradeCode -or
    $properties.Manufacturer -ne $config.bundle.publisher) {
    throw 'MSI publisher, version or upgrade identity is incorrect.'
}
$signature = Get-AuthenticodeSignature $package
($signature | Select-Object Status, StatusMessage, @{Name='Signer';Expression={if ($_.SignerCertificate) { $_.SignerCertificate.Subject } else { $null }}}) |
    ConvertTo-Json | Set-Content (Join-Path $PackageDirectory 'signature-status.json')
if ($RequireSignature -and $signature.Status -ne 'Valid') { throw 'Signed MSI lacks a valid trusted signature.' }

# A Defender scan is required; unavailable scanning is an error, not a clean result.
if (-not (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue)) {
    throw 'Microsoft Defender scan commands are unavailable on this runner.'
}
try { Update-MpSignature -ErrorAction Stop } catch {
    Write-Warning "Definition update failed; checking existing definition age: $_"
}
$status = Get-MpComputerStatus
$status | Select-Object AMServiceEnabled, AntivirusEnabled, AntivirusSignatureVersion, AntivirusSignatureLastUpdated |
    ConvertTo-Json | Set-Content (Join-Path $PackageDirectory 'defender-status.json')
if (-not $status.AMServiceEnabled -or -not $status.AntivirusEnabled -or
    -not $status.AntivirusSignatureLastUpdated -or
    ([datetime]::Now - $status.AntivirusSignatureLastUpdated).TotalDays -gt 7) {
    throw 'Defender is unavailable or its definitions are older than seven days.'
}
$scanner = Get-ChildItem "$env:ProgramData/Microsoft/Windows Defender/Platform/*/MpCmdRun.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $scanner) { $scanner = Join-Path $env:ProgramFiles 'Windows Defender/MpCmdRun.exe' }
if (-not (Test-Path $scanner)) { throw 'Defender scanner executable is unavailable.' }
function Invoke-DefenderCheck([string]$Path, [string]$LogName) {
    & $scanner -Scan -ScanType 3 -File $Path -DisableRemediation 2>&1 |
        Out-File (Join-Path $PackageDirectory $LogName)
    if ($LASTEXITCODE -ne 0) { throw "Defender scan failed/detected a threat; see $LogName ($LASTEXITCODE)." }
}
Invoke-DefenderCheck $package 'defender-msi.log'
function Invoke-MsiCheck([string]$Action, [string]$LogName, [string]$Path = $package) {
    $log = Join-Path $PackageDirectory $LogName
    $arguments = "$Action `"$Path`" /qn /norestart /l*v `"$log`""
    $result = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru
    if ($result.ExitCode -notin @(0, 3010)) {
        throw "MSI $Action failed with exit code $($result.ExitCode). See $LogName."
    }
}
# Products registered under this app's UpgradeCode (installed copies of LRCGET).
function Get-InstalledLrcget { @($installer.RelatedProducts($properties.UpgradeCode)) }
if (@(Get-InstalledLrcget).Count -ne 0) { throw 'LRCGET is already installed on the test runner.' }
$installed = $false
$process = $null
try {
    if ($PreviousPackage) {
        # Users upgrade over the published MSI; it must be replaced, not duplicated.
        Invoke-MsiCheck '/i' 'previous-install.log' (Resolve-Path $PreviousPackage).Path
        $installed = $true
        if (@(Get-InstalledLrcget).Count -ne 1) { throw 'Previous MSI did not register exactly one LRCGET.' }
    }
    Invoke-MsiCheck '/i' 'install.log'
    $installed = $true
    $products = @(Get-InstalledLrcget)
    if ($products.Count -ne 1 -or $products[0] -ne $properties.ProductCode) {
        throw "Upgrade left $($products.Count) LRCGET installs instead of exactly this MSI."
    }
    Invoke-MsiCheck '/fa' 'reinstall.log'
    # Resolve the main executable through this MSI's registered component path.
    $view = $database.OpenView('SELECT `Component_`, `FileName` FROM `File`')
    $view.Execute()
    $mainComponent = $null
    while ($null -ne ($record = $view.Fetch())) {
        if ($record.StringData(2).Split('|')[-1] -ieq 'LRCGET.exe') { $mainComponent = $record.StringData(1); break }
    }
    $view.Close()
    if (-not $mainComponent) { throw 'MSI has no LRCGET executable component.' }
    $view = $database.OpenView("SELECT ``ComponentId`` FROM ``Component`` WHERE ``Component``='$mainComponent'")
    $view.Execute()
    $record = $view.Fetch()
    if ($null -eq $record) { throw 'Main executable has no component identity.' }
    $componentId = $record.StringData(1)
    $view.Close()
    $executables = @($installer.ComponentPath($properties.ProductCode, $componentId) | Where-Object { $_ -and (Test-Path $_ -PathType Leaf) })
    if ($executables.Count -ne 1) { throw 'Expected one installed LRCGET executable.' }
    if ($RequireSignature -and (Get-AuthenticodeSignature $executables[0]).Status -ne 'Valid') {
        throw 'Installed LRCGET executable lacks a valid trusted signature.'
    }
    Invoke-DefenderCheck (Split-Path $executables[0]) 'defender-payload.log'
    $process = Start-Process $executables[0] -PassThru
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Milliseconds 500
        $process.Refresh()
        if ($process.HasExited) { throw "Installed app exited unexpectedly ($($process.ExitCode))." }
        if ($process.MainWindowHandle -ne 0) { break }
    }
    if ($process.MainWindowHandle -eq 0) { throw 'Installed app did not open a window.' }
    Start-Sleep -Seconds 2
    $process.Refresh()
    if ($process.HasExited) { throw 'Installed app crashed after opening.' }
    @{ executable = $executables[0]; windowTitle = $process.MainWindowTitle; launched = $true } |
        ConvertTo-Json | Set-Content (Join-Path $PackageDirectory 'launch-status.json')
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit()
    Invoke-MsiCheck '/x' 'uninstall.log'
    $installed = $false
    if (@(Get-InstalledLrcget).Count -ne 0) { throw 'Uninstall left LRCGET registered with Windows Installer.' }
    if (Test-Path $executables[0]) { throw 'Uninstall left the LRCGET executable behind.' }
    $upgradeNote = if ($PreviousPackage) { 'upgrade over the published MSI, ' } else { '' }
    Write-Output "MSI identity/checksum, Defender MSI/payload scans, $($upgradeNote)install, repair reinstall, app launch and clean uninstall passed."
} finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    if ($installed) { Invoke-MsiCheck '/x' 'uninstall.log' }
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($database) | Out-Null
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer) | Out-Null
}

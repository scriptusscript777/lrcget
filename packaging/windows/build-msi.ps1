[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') {
    throw 'The supported Tauri MSI builder requires Windows. Run this script on Windows 11 x64.'
}
foreach ($tool in @('node', 'npm.cmd', 'cargo', 'rustup')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing $tool. See packaging/windows/README.md for Windows build prerequisites."
    }
}
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$configPath = Join-Path ([IO.Path]::GetTempPath()) ("lrcget-msi-{0}.json" -f [Guid]::NewGuid())
Push-Location $repo
try {
    $configJson = & node (Join-Path $PSScriptRoot 'msi-config.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'MSI configuration generation failed.' }
    [IO.File]::WriteAllText($configPath, ($configJson -join "`n"), [Text.UTF8Encoding]::new($false))
    & rustup target add x86_64-pc-windows-msvc
    if ($LASTEXITCODE -ne 0) { throw 'Windows Rust target setup failed.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency setup failed.' }
    # Remove stale packages from this exact target folder before building.
    $bundleDir = Join-Path $repo 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi'
    if (Test-Path $bundleDir) { Get-ChildItem $bundleDir -Filter '*.msi' -File | Remove-Item -Force }
    & npm.cmd run tauri -- build --target x86_64-pc-windows-msvc --bundles msi --features custom-protocol --config $configPath -- --no-default-features
    if ($LASTEXITCODE -ne 0) { throw 'Tauri MSI build failed. No installer has been delivered.' }
    $packages = @(Get-ChildItem $bundleDir -Filter '*.msi' -File)
    if ($packages.Count -ne 1) { throw 'Expected exactly one fresh en-US x64 MSI.' }
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $destination = Join-Path $OutputDirectory $packages[0].Name
    if ($packages[0].FullName -ne [IO.Path]::GetFullPath($destination)) {
        Copy-Item $packages[0].FullName $destination -Force
    }
    $hash = (Get-FileHash $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$destination.sha256", "$hash  $($packages[0].Name)`n", [Text.UTF8Encoding]::new($false))
    Write-Output "Created: $destination"
    Write-Output "SHA256: $hash"
} finally {
    if (Test-Path $configPath) { Remove-Item $configPath -Force }
    Pop-Location
}

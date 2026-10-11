[CmdletBinding()]
param([Parameter(Mandatory)][string]$PackageDirectory)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Installation checks are restricted to a disposable Windows CI runner.'
}
$packages = @(Get-ChildItem $PackageDirectory -Filter '*.msi' -File)
if ($packages.Count -ne 1) { throw 'Expected exactly one MSI to test.' }
$package = $packages[0].FullName
$expectedHash = (Get-Content "$package.sha256" -Raw).Split(' ')[0]
if ((Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'MSI checksum does not match.'
}
function Invoke-MsiCheck([string]$Action, [string]$LogName) {
    $log = Join-Path $PackageDirectory $LogName
    $arguments = "$Action `"$package`" /qn /norestart /l*v `"$log`""
    $result = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru
    if ($result.ExitCode -notin @(0, 3010)) {
        throw "MSI $Action failed with exit code $($result.ExitCode). See $LogName."
    }
}
$installed = $false
try {
    Invoke-MsiCheck '/i' 'install.log'
    $installed = $true
    Invoke-MsiCheck '/i' 'reinstall.log'
    Write-Output 'MSI checksum, silent install and same-version reinstall passed.'
} finally {
    if ($installed) { Invoke-MsiCheck '/x' 'uninstall.log' }
}

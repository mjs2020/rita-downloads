#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$Reconfigure,
    [switch]$UpdateCredentials,
    [switch]$RefreshAudioProfile
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$ConfigFile = Join-Path $ScriptDir 'config.local.json'
$ExePath = Join-Path $ScriptDir 'SoundVolumeView.exe'
$ProfilePath = Join-Path $ScriptDir 'AudioProfile_Default.spr'
$EnforceScript = Join-Path $ScriptDir 'enforce-config.ps1'
$TaskName = 'EnforceBaselineConfig'
$PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Read-RequiredValue {
    param([string]$Prompt)
    do { $Value = Read-Host $Prompt } while ([string]::IsNullOrWhiteSpace($Value))
    return $Value.Trim()
}

try {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($Identity)
    if ($Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this installer from ordinary PowerShell as the user who uses Explorer, without Run as administrator.'
    }
    if (-not (Test-Path -LiteralPath $EnforceScript)) {
        throw "Missing enforcement script: $EnforceScript"
    }

    $NewConfig = $Reconfigure -or -not (Test-Path -LiteralPath $ConfigFile)
    if ($NewConfig) {
        Write-Host '--- NAS Configuration Setup ---' -ForegroundColor Yellow
        $NasHost = Read-RequiredValue 'Enter NAS IP or hostname (e.g., 192.168.1.100)'
        $ShareA = (Read-RequiredValue 'Enter share/subfolder for A: Audio e Musica (e.g., music\rita)').Trim('\')
        $ShareB = (Read-RequiredValue 'Enter share/subfolder for B: Documenti (e.g., home\Documenti)').Trim('\')
        if ([string]::IsNullOrWhiteSpace($ShareA) -or [string]::IsNullOrWhiteSpace($ShareB)) {
            throw 'Share paths must contain a share name.'
        }
        $Config = [PSCustomObject]@{
            NasHost = $NasHost
            ShareA_Path = "\\$NasHost\$ShareA"
            ShareB_Path = "\\$NasHost\$ShareB"
        }
    } else {
        $Config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
        $NasHost = [string]$Config.NasHost
        Write-Host "Reusing existing configuration: $ConfigFile" -ForegroundColor Green
    }
    if ([string]::IsNullOrWhiteSpace($NasHost) -or $NasHost -match '[\\/\s]') {
        throw 'NasHost must be an IP address or hostname, without slashes or whitespace.'
    }
    foreach ($SharePath in @($Config.ShareA_Path, $Config.ShareB_Path)) {
        if ($SharePath -notmatch '^\\\\[^\\]+\\[^\\]+' -or ($SharePath -split '\\')[2] -ne $NasHost) {
            throw 'Both share paths must be UNC paths using the configured NasHost.'
        }
    }
    if ($NewConfig) {
        $Config | ConvertTo-Json -Depth 2 | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
        Write-Host "Generated local configuration: $ConfigFile" -ForegroundColor Green
    }

    # Updating an existing installation does not require entering the NAS password again.
    if ($NewConfig -or $UpdateCredentials) {
        $NasUser = Read-RequiredValue 'Enter NAS username (include a domain only if your NAS requires it)'
        $SecurePass = Read-Host 'Enter NAS password' -AsSecureString
        $BSTR = [IntPtr]::Zero
        $PlainPass = $null
        try {
            $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
            $PlainPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
            # One entry for the exact host used by the UNC paths; do not overwrite the username.
            & cmdkey.exe "/add:$NasHost" "/user:$NasUser" "/pass:$PlainPass"
            if ($LASTEXITCODE -ne 0) {
                throw 'Could not save NAS credentials to Windows Credential Manager.'
            }
        } finally {
            if ($BSTR -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) }
            $PlainPass = $null
            $SecurePass.Dispose()
        }
    }

    if (-not (Test-Path -LiteralPath $ExePath)) {
        $ZipPath = Join-Path $ScriptDir 'soundvolumeview-x64.zip'
        Write-Host 'Downloading SoundVolumeView (64-bit)...' -ForegroundColor Cyan
        # TLS 1.2 works with Windows PowerShell 5.1; TLS 1.3 is not available on all .NET Framework versions.
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $WebClient = New-Object Net.WebClient
        try {
            $WebClient.Headers.Add('User-Agent', 'Mozilla/5.0')
            $WebClient.DownloadFile('https://www.nirsoft.net/utils/soundvolumeview-x64.zip', $ZipPath)
            Expand-Archive -LiteralPath $ZipPath -DestinationPath $ScriptDir -Force
        } finally {
            $WebClient.Dispose()
            Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
        }
        if (-not (Test-Path -LiteralPath $ExePath)) {
            throw 'SoundVolumeView.exe not found after extraction.'
        }
    }

    if ($RefreshAudioProfile -or -not (Test-Path -LiteralPath $ProfilePath)) {
        Write-Host 'Capturing the current audio configuration...' -ForegroundColor Cyan
        $AudioProcess = Start-Process -FilePath $ExePath -ArgumentList "/SaveProfile `"$ProfilePath`"" -Wait -PassThru -WindowStyle Hidden
        if ($AudioProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $ProfilePath)) {
            throw 'SoundVolumeView did not save the audio profile successfully.'
        }
    }

    Write-Host "Registering logon task for $($Identity.Name)..." -ForegroundColor Cyan
    $Action = New-ScheduledTaskAction -Execute $PowerShellExe -WorkingDirectory $ScriptDir `
        -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$EnforceScript`""
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $Identity.Name
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId $Identity.Name -LogonType Interactive -RunLevel Limited
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
        -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    try {
        # Update in place. Do not delete a working task before registration succeeds.
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
            -Principal $TaskPrincipal -Settings $Settings -Force `
            -Description 'Mount NAS drives A & B and restore audio in the desktop user session.' | Out-Null
    } catch {
        throw "Could not register $TaskName. If the old task was created as Administrator, remove that old task in an elevated window, then rerun this installer normally. Details: $($_.Exception.Message)"
    }

    Write-Host 'Testing enforcement...' -ForegroundColor Cyan
    & $PowerShellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $EnforceScript
    if ($LASTEXITCODE -ne 0) {
        throw 'The task was registered, but enforcement failed. Check enforce-config.log and rerun enforce-config.ps1 after fixing the problem.'
    }
    Write-Host 'Installation and enforcement completed successfully.' -ForegroundColor Green
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}

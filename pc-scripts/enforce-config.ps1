#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$ConfigFile = Join-Path $ScriptDir 'config.local.json'
$AudioProfile = Join-Path $ScriptDir 'AudioProfile_Default.spr'
$SoundVolExe = Join-Path $ScriptDir 'SoundVolumeView.exe'
$ExitCode = 0
$TranscriptStarted = $false

function Test-QuickAccessContains {
    param($Shell, [string]$Root, [string]$UNC)
    $QuickAccess = $Shell.NameSpace('shell:::{679f85cb-0220-4080-b29b-5540cc05aab6}')
    if ($null -eq $QuickAccess) {
        throw 'Explorer Quick Access is unavailable.'
    }
    foreach ($Item in $QuickAccess.Items()) {
        $ItemPath = ([string]$Item.Path).TrimEnd('\')
        # Explorer can store either the drive root or its underlying UNC path.
        if ($ItemPath -eq $Root.TrimEnd('\') -or $ItemPath -eq $UNC.TrimEnd('\')) {
            return $true
        }
    }
    return $false
}

try {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($Identity)
    if ($Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Open PowerShell normally, without Run as administrator. Explorer needs mappings in the desktop user session.'
    }

    # Overwrite the previous run so repeated logons do not grow the log indefinitely.
    Start-Transcript -Path (Join-Path $ScriptDir 'enforce-config.log') -Force | Out-Null
    $TranscriptStarted = $true
    Write-Host '--- Starting Enforce Config ---' -ForegroundColor Cyan
    Write-Host "Running as: $($Identity.Name)"

    $Config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
    $NasHost = [string]$Config.NasHost
    if ([string]::IsNullOrWhiteSpace($NasHost) -or $NasHost -match '[\\/\s]') {
        throw 'NasHost must be an IP address or hostname, without slashes or whitespace.'
    }
    $DrivesToMount = @(
        [PSCustomObject]@{ Letter = 'A:'; UNC = [string]$Config.ShareA_Path; Label = 'Audio e Musica' },
        [PSCustomObject]@{ Letter = 'B:'; UNC = [string]$Config.ShareB_Path; Label = 'Documenti' }
    )
    foreach ($Drive in $DrivesToMount) {
        if ($Drive.UNC -notmatch '^\\\\[^\\]+\\[^\\]+' -or ($Drive.UNC -split '\\')[2] -ne $NasHost) {
            throw "Invalid UNC path for $($Drive.Letter): it must use the configured NasHost."
        }
        $Drive.UNC = $Drive.UNC.TrimEnd('\')
    }

    if ((Test-Path -LiteralPath $SoundVolExe) -and (Test-Path -LiteralPath $AudioProfile)) {
        try {
            Write-Host 'Applying audio profile...' -ForegroundColor Cyan
            $AudioProcess = Start-Process -FilePath $SoundVolExe -ArgumentList "/LoadProfile `"$AudioProfile`"" -Wait -PassThru -WindowStyle Hidden
            if ($AudioProcess.ExitCode -ne 0) {
                throw "SoundVolumeView failed with exit code $($AudioProcess.ExitCode)."
            }
        } catch {
            $ExitCode = 1
            Write-Warning "Audio restore failed: $($_.Exception.Message). Continuing with drive mappings."
        }
    } else {
        Write-Warning 'Audio executable or profile not found. Skipping audio restore.'
    }

    Write-Host "Checking SMB service on $NasHost..." -ForegroundColor Cyan
    $Online = $false
    for ($Attempt = 1; $Attempt -le 6; $Attempt++) {
        if (Test-NetConnection -ComputerName $NasHost -Port 445 -InformationLevel Quiet -WarningAction SilentlyContinue) {
            $Online = $true
            break
        }
        if ($Attempt -lt 6) {
            Write-Warning "Attempt $Attempt of 6: NAS not reachable. Retrying in 3 seconds..."
            Start-Sleep -Seconds 3
        }
    }
    if (-not $Online) {
        throw "Could not reach $NasHost on port 445. Existing mappings have been left intact."
    }

    $Network = New-Object -ComObject WScript.Network
    $Shell = New-Object -ComObject Shell.Application
    foreach ($Drive in $DrivesToMount) {
        try {
            $Letter = $Drive.Letter
            $Root = $Letter + '\'
            $UNC = $Drive.UNC
            $ExistingUNC = $null
            $Mappings = $Network.EnumNetworkDrives()
            # WshCollection exposes Count as a COM method in PowerShell.
            $MappingCount = $Mappings.Count()
            for ($Index = 0; $Index -lt $MappingCount; $Index += 2) {
                if ($Mappings.Item($Index) -eq $Letter) {
                    $ExistingUNC = $Mappings.Item($Index + 1)
                    break
                }
            }

            if (($ExistingUNC -eq $UNC) -and (Test-Path -LiteralPath $Root)) {
                Write-Host "$Letter is already mapped to $UNC."
            } else {
                if ($ExistingUNC) {
                    # Only replace this configured network drive; never purge other NAS sessions.
                    $Result = & net.exe use $Letter /delete /y 2>&1
                    if ($LASTEXITCODE -ne 0) {
                        throw "Could not disconnect ${Letter}: $($Result -join ' ')"
                    }
                } elseif (Get-PSDrive -Name $Letter.TrimEnd(':') -ErrorAction SilentlyContinue) {
                    throw "$Letter is occupied by another drive. It will not be replaced."
                }

                Write-Host "Mounting $Letter -> $UNC ..." -ForegroundColor Yellow
                # Pass native arguments directly rather than constructing a cmd.exe command.
                $Result = & net.exe use $Letter $UNC /persistent:no 2>&1
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to mount ${Letter}: $($Result -join ' ')"
                }
                if (-not (Test-Path -LiteralPath $Root)) {
                    throw "$Letter was mapped but its root is inaccessible. Check NAS permissions."
                }
            }

            # The leading two backslashes already become ##. Do not prepend another ##.
            $MountKey = Join-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2' ($UNC.Replace('\', '#'))
            New-Item -Path $MountKey -Force | Out-Null
            New-ItemProperty -Path $MountKey -Name '_LabelFromReg' -Value $Drive.Label -PropertyType String -Force | Out-Null

            # Ask Explorer to rename the mapped drive itself, including mappings to subfolders.
            $ShellDrive = $Shell.NameSpace($Root)
            if ($null -eq $ShellDrive) {
                throw "Explorer cannot resolve $Root to apply its friendly name."
            }
            $ShellDrive.Self.Name = $Drive.Label
            Write-Host "$Letter ready: $($Drive.Label)" -ForegroundColor Green

            # Use the canonical verb, independent of the Windows display language.
            # Check first: invoking it again can toggle an existing pin on some builds.
            try {
                if (Test-QuickAccessContains -Shell $Shell -Root $Root -UNC $UNC) {
                    Write-Host "$Letter is already in Quick Access (Accesso Rapido)."
                } else {
                    $ShellDrive.Self.InvokeVerb('pintohome')
                    # Shell verbs can complete asynchronously or silently do nothing.
                    $InQuickAccess = $false
                    for ($PinAttempt = 0; $PinAttempt -lt 5; $PinAttempt++) {
                        Start-Sleep -Milliseconds 400
                        if (Test-QuickAccessContains -Shell $Shell -Root $Root -UNC $UNC) {
                            $InQuickAccess = $true
                            break
                        }
                    }
                    if (-not $InQuickAccess) {
                        throw 'Explorer did not add the drive. Right-click it and choose Pin to Quick access manually.'
                    }
                    Write-Host "$Letter added to Quick Access (Accesso Rapido)." -ForegroundColor Green
                }
            } catch {
                # A cosmetic Explorer failure must not invalidate a working drive mapping.
                Write-Warning "Quick Access setup for $Letter failed: $($_.Exception.Message)"
            }
        } catch {
            $ExitCode = 1
            Write-Warning "$($Drive.Letter) configuration failed: $($_.Exception.Message)"
        }
    }
    if ($ExitCode -ne 0) {
        throw 'Audio restoration, drive mapping or labeling failed. See enforce-config.log.'
    }
    Write-Host '--- Finished Enforce Config ---' -ForegroundColor Cyan
} catch {
    $ExitCode = 1
    Write-Error $_ -ErrorAction Continue
} finally {
    if ($TranscriptStarted) { Stop-Transcript | Out-Null }
}
exit $ExitCode

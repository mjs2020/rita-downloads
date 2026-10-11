# Windows NAS drives and audio configuration

Maps the NAS folders to `A:` (**Audio e Musica**) and `B:` (**Documenti**) and restores a SoundVolumeView audio profile at logon. The task runs only in the configured user's interactive session, without elevation, so Explorer and ordinary desktop applications can see the drives.

## Install

1. Copy the contents of this folder directly into `C:\ScriptsRita` (or another folder writable by the desktop user).
2. Set up and check the audio devices and application settings you want to save. SoundVolumeView restores the settings captured in its profile; verify NVDA, Audacity and VLC after restoration rather than assuming every application setting is covered. See the [SoundVolumeView documentation](https://www.nirsoft.net/utils/sound_volume_view.html).
3. Open **Windows PowerShell normally**, as the Windows user who uses Explorer. Do **not** choose **Esegui come amministratore**.
4. Run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
& C:\ScriptsRita\install-service.ps1
```

On first installation, enter the NAS host, share/subfolder paths and NAS credentials. For example, enter `music\rita` for A: and `home\Documenti` for B:. Enter paths relative to the NAS host, not complete UNC paths. The installer creates `config.local.json`, stores credentials for the exact NAS hostname/IP, downloads the 64-bit SoundVolumeView utility if needed, saves the initial audio profile, registers the logon task and tests enforcement.

The scripts require Windows PowerShell 5.1 and a 64-bit Windows PC. `C:\ScriptsRita` must be writable by the desktop user for configuration, downloads and logs. If copying the files requires administrator permissions, perform that copy separately, then return to ordinary PowerShell for installation.

## Update an existing installation

Copy the updated `.ps1` files into the existing installation folder, keeping `config.local.json`, `SoundVolumeView.exe` and `AudioProfile_Default.spr`. Run `install-service.ps1` again from ordinary PowerShell. It reuses your configuration, stored credentials and audio profile and updates the scheduled task.

If updating the task reports access denied because the previous version was installed as Administrator, run this **once in an Administrator PowerShell window**:

```powershell
Unregister-ScheduledTask -TaskName EnforceBaselineConfig -Confirm:$false
```

Then close that window and rerun the installer from **ordinary PowerShell**. If the old setup used a different administrator account, save the NAS credentials under the desktop user with `-UpdateCredentials`.

Optional installer switches:

```powershell
# Enter the NAS connection details and credentials again.
& C:\ScriptsRita\install-service.ps1 -Reconfigure

# Replace stored NAS credentials while keeping the existing paths.
& C:\ScriptsRita\install-service.ps1 -UpdateCredentials

# Replace the saved audio baseline with the current settings.
& C:\ScriptsRita\install-service.ps1 -RefreshAudioProfile
```

## Explorer names and grouping

The script sets the full friendly names **Audio e Musica** and **Documenti**, including for shares mapped to subfolders. It fixes the MountPoints2 registry path and asks Explorer to rename each mapped drive. Refresh **This PC** with F5; if Explorer retains an old cached name, sign out and sign back in. Explorer may still append the drive letter, depending on its settings.

After naming each drive, the script also adds its root to **Accesso Rapido** / **Quick Access** using Explorer's `pintohome` shell verb. Entries already listed there (as drive letters or their UNC paths) are left alone, so repeated logons do not toggle existing pins. Other Quick Access entries are untouched. If a drive is removed from Quick Access, the next enforcement run attempts to add it again. Pinning depends on the Windows Explorer version; a failed attempt records a warning without failing the drive mapping. You can also right-click the drive and choose **Aggiungi ad Accesso rapido** manually.

These are real mapped network drives, usable as `A:\` and `B:\`, even though Explorer groups them under **Percorsi di rete** / **Network locations**. Mapping cannot turn a NAS share into a local disk. To show local and network drives together, open **This PC**, right-click an empty area and choose **Group by > None** (**Raggruppa per > Nessuno**, wording may vary by Windows version). No system-wide Explorer settings are changed by these scripts.

Existing healthy mappings to the configured paths are kept, so rerunning enforcement does not interrupt them. A disconnected or changed mapping on A: or B: is replaced; these two letters are reserved for this setup. Local drives occupying those letters are never removed. Other drive mappings and NAS sessions are left intact. Mappings are recreated at logon rather than saved with Windows automatic reconnection.

## Verify and troubleshoot

Run from ordinary Windows PowerShell:

```powershell
& C:\ScriptsRita\enforce-config.ps1
net use
Test-Path A:\
Test-Path B:\

Get-ScheduledTask -TaskName EnforceBaselineConfig |
    Select-Object -ExpandProperty Principal
Get-ScheduledTaskInfo -TaskName EnforceBaselineConfig
```

The task principal should identify the desktop user, use an interactive logon and have `RunLevel` set to `Limited`. In Task Scheduler, **Run only when user is logged on** should be selected and **Run with highest privileges** should be unchecked. Mapped drives are [specific to a logon session](https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/mapped-drives-not-available-from-elevated-command), so elevated applications may not see these mappings.

`enforce-config.log` records the latest run, including the account, mapping results and errors. Enforcement exits with code 1 on failure; Task Scheduler retries failures up to three times at one-minute intervals. Network checks also retry within each run. Existing mappings are preserved if the NAS cannot be reached. This is logon recovery, not continuous monitoring: if the NAS becomes available after all retries, rerun enforcement or start the scheduled task manually.

If authentication fails, confirm that Credential Manager contains a Windows credential for exactly the hostname/IP in the share paths and run the installer with `-UpdateCredentials`. SMB error 1219 means another connection to the same NAS uses different credentials; inspect `net use` and disconnect the conflicting connection deliberately. The scripts do not clear all NAS connections automatically.

## Local files

`config.local.json`, downloaded executables/archives, audio profiles and logs are ignored by Git. The configuration contains endpoints, not passwords. NAS passwords are stored in the current user's Windows Credential Manager. During installation, `cmdkey.exe` receives the password as a process argument; the script clears its temporary plaintext reference and releases the unmanaged buffer afterwards. Do not commit manually created credential exports or other files containing secrets.

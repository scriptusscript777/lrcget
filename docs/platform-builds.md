# All platform builds and limitations — 2.2.7

The same source supplies the platform targets below. Available Tauri targets are
not equivalent to packages verified for this fork. Use [packages](packages.md)
for current artifact/test status and [source instructions](build-from-source.md)
for dependencies. The app remains `net.lrclib.lrcget` on every platform.

| Build                               | Build host and command                                                                   | Status and limitations                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debian x64                          | Linux: `npm run tauri -- build --bundles deb`                                            | Current Debian-only 2.2.7 build on this Mint PC; see package/review installation status. Package `lrcget` upgrades in place. Current build requires glibc 2.39+. Other Debian desktops are not all verified.                                                                                                                                      |
| AppImage x64                        | Linux: `npm run tauri -- build --bundles appimage`                                       | Built, checksum verified and native startup tested in a temporary profile. Linux x64, glibc 2.39+. FUSE 2 or extract-and-run required. Not a universal build for older Linux releases.                                                                                                        |
| Windows MSI x64                     | Windows with MSVC/SDK: `./packaging/windows/build-msi.ps1`                               | Native build/test workflow provided. See package status for actual results. Fixed upgrade identity, three-field version mapping, unsigned package unless signing configured. WebView2 bootstrapper may download the runtime. Windows 11 desktop/older-version upgrade checks remain separate. |
| Windows NSIS x64                    | Windows with MSVC/SDK: `npm run tauri -- build --bundles nsis`                           | Alternative `.exe` installer target; not built/tested for this release. Do not assume its upgrade/version behavior equals the reviewed MSI overlay.                                                                                                                                           |
| Linux RPM x64                       | Compatible Linux: `npm run tauri -- build --bundles rpm`                                 | Configuration exists but current RPM is not built/tested. Dependencies, distro integration and glibc baseline require validation on target systems.                                                                                                                                           |
| macOS DMG/bundle                    | macOS: `npm run tauri -- build --target aarch64-apple-darwin` (or `x86_64-apple-darwin`) | Upstream platform target; no current fork artifact/test. Needs Apple toolchain, target architecture, signing/notarization for distribution and native audio tests.                                                                                                                            |
| Linux/Windows ARM or Windows 32-bit | Appropriate native/cross toolchain and explicit Rust target                              | Not provided or verified for this release. x64 installers do not establish native ARM/32-bit compatibility.                                                                                                                                                                                   |
| Linux development                   | `npm run tauri dev`                                                                      | Native debug app; not a redistributable installer. `npm run dev` alone is only the frontend server.                                                                                                                                                                                           |

AppImage and Windows changes/builds are deferred until Rick requests them.
Older artifacts remain available but do not include 2.2.7 fixes.

## MSI and Linux cross tools

MinGW builds Windows C/C++ programs; this Tauri application officially targets
MSVC. `cargo-xwin` can obtain Windows SDK/toolchain components for cross-building,
but successful cross compilation still needs Windows runtime testing. `wixl`
can create MSI databases but does not replace Tauri's supported Windows/WiX build
or prove that the packaged app works. Wine is a compatibility test environment,
not a Windows 11 desktop certification. Current release MSI construction uses
the native GitHub Windows runner rather than a custom Linux MSI template.

Installed cross tools on Rick's PC are recorded in the
[Windows guide](../packaging/windows/README.md). No system administrator password
was stored; missing cross tools were installed in the user profile where possible.

## Runtime, data and export limitations

- Run one installed/portable version at a time; they share the same application
  identity and profile. An AppImage is portable as a program, not automatically
  isolated as a data profile. Back up data before testing another version.
- The AppImage bundles many dependencies but cannot remove its glibc baseline or
  guarantee all graphics/audio environments. Its native smoke test checks startup,
  not every Linux distribution or every song.
- Windows build/installation checks on Windows Server do not verify interactive
  Windows 11 playback, devices, every upgrade path or SmartScreen reputation.
  Signing requires a certificate not included in the source archive.
- MSI embeds the small WebView2 bootstrapper, not the complete offline runtime.
  Installation on a PC without WebView2 may require network access.
- LRC, ELRC and embedded ID3 syntax can be valid while individual players do not
  support word highlighting. Keep standard LRC alongside optional word outputs.
- The editor imports TXT, LRC and ELRC. Inline enhanced tags inside .lrc files
  are recognized too. Nonzero offsets, ambiguous repeated line tags with absolute
  word times, malformed ranges and out-of-order enhanced rows report an error.
  Automatic .elrc library scanning is not added. A standard LRC can retain line
  gaps with blank cues but cannot retain every word end; use ELRC or the internal
  document for word timing.
- Timing is manual. Loop audition uses approximately 40 ms player notifications.
  Saved millisecond resolution does not imply sample-accurate loop boundaries.
- Save/export/publish are distinct. Publishing needs the configured LRCLIB service
  and network; it does not upload ELRC sidecars. Failed targets can coexist with
  successfully exported targets. Keep independent backups.

For code flow, checks and maintenance see the [developer guide](developer-guide.md).

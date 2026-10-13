This is LRCGET — a desktop music player with synced lyrics support.

Stack: Tauri v2 (Rust backend + Vue 3 frontend).

To help you quickly understand the project architecture:

- For the frontend (Vue), see `src/ARCHITECTURE.md`.
- For the backend (Rust), see `src-tauri/ARCHITECTURE.md`.

Read these files before working on the corresponding frontend or backend tasks.

After completing your changes, update these two `ARCHITECTURE.md` files as needed.

If your changes are related to the backend, run `cargo check` in the `src-tauri/` directory. If your changes are only related to the frontend, you do not need to run any checks.

## Inspecting a running dev build (W3C WebDriver)

Debug builds serve a W3C WebDriver server on `http://127.0.0.1:4445` (via `tauri-plugin-webdriver`, backend details in `src-tauri/ARCHITECTURE.md`); drive it with any WebDriver client (Selenium, WebdriverIO, raw curl). Works on X11 and any Wayland compositor — no extra tools needed.

```bash
setsid npm run tauri dev </dev/null > /tmp/lrcget-dev.log 2>&1 & disown
while ! curl -sf http://127.0.0.1:4445/status >/dev/null; do sleep 5; done
```

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
driver = webdriver.Remote(command_executor="http://127.0.0.1:4445",
                          options=webdriver.ChromeOptions())  # options ignored
driver.get("http://localhost:1420")   # dev-mode URL (Vite); webview is usually already here
driver.find_element(By.CSS_SELECTOR, ".my-button").click()
driver.save_screenshot("/tmp/lrcget.png")          # full webview PNG
print(driver.execute_script("return document.title"))
driver.quit()                                       # always end the session
```

## Rick's Maintenance Workflow

For every code update, review control flow and bugs, fix introduced issues,
and run checks appropriate to the language (including Ruff for Python and
cargo check/tests for Rust). Distinguish existing findings from new ones.
Update current documentation; change the version only when Rick explicitly
requests it. Capture current screenshots
for visible behavior changes. Preserve historical release notes.
Commit completed work locally and publish to Rick's GitHub fork and configured
local Git server without rewriting history. Never push local releases to upstream.
For completed LRCGET updates, notify the original creator through a GitHub issue
linking the fork/release and a focused upstream pull request. Keep unrelated
existing PRs unchanged, and avoid duplicate notifications. Report actual outcomes
and any blocked installation or publication steps.

Do not change application/release version numbers unless Rick explicitly asks.
Rick requested this freeze on 2026-10-11, superseding automatic version increments.
Continue the remaining maintenance steps for each code update: logic/bug review,
appropriate checks, documentation/screenshots, Debian builds and local Git/server
backups. Rick authorized current Debian/AppImage/MSI, source, illustrated guides
and developer notification publication on 2026-10-12.
When Rick requests a version bump, advance the main version, not `+local.xx`.
Rick prefers decimal carry: 2.2.1 through 2.2.9, then 2.3.0; 2.9.9 advances to
3.0.0. Preserve existing historical artifact names and package/application identity.
Use an explicit same-version reinstall when needed; do not invent a suffix to
force an upgrade.

Release publication (Rick, 2026-10-12, supersedes dated artifact backups): after
every completed update, publish the Debian `.deb`, AppImage, Windows `.msi`
(built and install/upgrade/uninstall-checked by `.github/workflows/windows-msi.yml`),
source ZIP/tar.gz, docs ZIP and SHA256 files to the current GitHub release,
replacing the previous files. Keep only the latest artifacts: remove older
releases, installers and dated `before-*` folders locally and on GitHub; history
remains in Git and `lrcget-backup.bundle`. Run unit, native and end-to-end update
checks first; releases must be production-ready. A user-visible update alert
fires only for a higher version, so a same-version rebuild does not notify users.

Apply this maintenance workflow every time this app is modified. Update feature
lists, how-tos and release notes together; capture fresh light/dark screenshots
for changed visible behavior and verify documentation/download links. Verify the
Debian package remains `lrcget` for the same architecture, uses the existing
`net.lrclib.lrcget` identifier/data location, and sorts above the installed version
so it upgrades in place. Publish the installer/checksum and link the illustrated
guides in the creator notification. Report existing check findings separately
from new ones, and never claim a blocked server backup, install or upstream PR
was completed.

When Rick asks for recommendations/improvements in the active task, implement
actionable improvements within its scope and verify them rather than leaving
them as a list of future suggestions. Keep the result focused on lyric editing,
clear controls and realistic user flows; report dependencies that cannot be
completed without external access or a broader upstream port.

### Existing local Git server backup

Rick's server backup is the parent `/home/rick/Projects` repository, remote
`origin` at `ssh://git@192.168.25.13/rick/Projects_Folder.git`, branch `main`.
Refresh `lrcget-source/` from the release commit, `lrcget-backup.bundle` with full
history/release tags, and `lrcget-installers/` with the installer/checksum. Update
`lrcget-backup-README.md`, commit only these paths and push/verify `main`. Preserve
unrelated projects and older installers. A separate server `rick/lrcget` repository
is not needed.

### Current platform focus

Rick resumed AppImage and Windows MSI builds on 2026-10-12. Build-only GitHub
Actions MSI validation passed. Rick authorized publication of the current
Debian/AppImage/MSI beta, docs/images/how-tos and original-developer notification. Current Debian remains included and version stays
2.2.7 until Rick explicitly changes it. When Windows work
resumes, include Defender definition/availability checks and scans of the MSI
and payload, isolated installed-app launch checks, publisher/version/upgrade
identity inspection and diagnostics. Signing and Windows 11 desktop validation
remain distinct from a Windows Server CI run; do not claim SmartScreen reputation
or Smart App Control compatibility from antivirus scans alone.

Rick requested latest accurate docs/images for every new feature integration.
Before publication, audit all current user-guide screenshot references, recapture
views affected by integrations in both themes, and refresh the screenshot manifest
with actual provenance. Do not call historical images current or treat mocked
browser captures as native OS tests. Keep downloadable docs/source archives and
GitHub/local server backups consistent. Update privacy/signing policies when data
flows, permissions or signing behavior change; do not imply new Foundation approval.

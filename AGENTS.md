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
Update current documentation and release versions; capture current screenshots
for visible behavior changes. Preserve historical release notes.
Commit completed work locally and publish to Rick's GitHub fork and configured
local Git server without rewriting history. Never push local releases to upstream.
For completed LRCGET updates, notify the original creator through a GitHub issue
linking the fork/release and a focused upstream pull request. Keep unrelated
existing PRs unchanged, and avoid duplicate notifications. Report actual outcomes
and any blocked installation or publication steps.

For future application updates, advance the main version number rather than
incrementing a `+local.xx` suffix. Rick explicitly requested this on 2026-10-11;
use plain release versions such as `2.2.7` for the next application update.
Rick prefers decimal carry: 2.2.1 through 2.2.9, then 2.3.0; 2.9.9 advances to
3.0.0. Existing historical versions/artifacts retain their original names.
Keep package/application identity unchanged so upgrades replace the installed app.

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

Rick explicitly deferred all AppImage and Windows builds/updates until he asks
to resume them. Current fixes target the Debian package only. When Windows work
resumes, include Defender definition/availability checks and scans of the MSI
and payload, isolated installed-app launch checks, publisher/version/upgrade
identity inspection and diagnostics. Signing and Windows 11 desktop validation
remain distinct from a Windows Server CI run; do not claim SmartScreen reputation
or Smart App Control compatibility from antivirus scans alone.

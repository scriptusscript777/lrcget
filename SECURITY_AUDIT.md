# Dependency security audit

**Reviewed:** 2026-10-13

**Scope:** JavaScript and Rust dependencies used by LRCGET's Windows MSI and Linux DEB/AppImage builds.

## Changes made

- Updated the frontend lockfile and compatible Vue/Tauri packages to patched releases. Vite moved from 3.x to 6.4.4 with `@vitejs/plugin-vue` 5.2.4; this avoids the vulnerable Vite 3 line without moving to Vite 8.
- Updated the Rust lockfile to current compatible Tauri 2 packages and other compatible releases. The declared Rust minimum is now 1.92, matching the locked dependency requirements.
- Regenerated the checked-in third-party notices for the release dependency graph (581 components, none unreviewed). The generator normalizes tabs and trailing whitespace in copied license text without changing its wording. The Linux workflow adds AppImage-bundled library notices to the package during its packaging pass.
- Kept Tailwind CSS on 3.x. The remaining advisories below are development-tool findings and do not affect packaged runtime dependencies.

## Remaining security advisories

| Advisory | Dependency path and severity | Production reachability | Why it remains |
| --- | --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — `braces` stack-exhaustion DoS, high | `tailwindcss` → `chokidar` / `fast-glob` / `micromatch` → `braces` ≤3.0.3. All are npm development dependencies. | Not reachable in the installed application. The packages scan/watch trusted source files while running the build or development server; they are not shipped as runtime JavaScript. | No patched `braces` 3.x release is available. Tailwind 4 is the upstream path that replaces this dependency chain, but requires a separate CSS migration. Forcing an incompatible transitive dependency would risk the build. |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — `postcss-selector-parser` CPU exhaustion, moderate | `tailwindcss` → `postcss-nested` → `postcss-selector-parser` 6.1.4. All are npm development dependencies. | Not reachable in the installed application. Parsing is build-time CSS processing over the repository's trusted stylesheet sources; no app request or user lyric path invokes it. | The fixed release is 7.1.6, while the Tailwind 3 dependency chain requires the 6.x API and has no patched 6.x release. A Tailwind 4 migration is the compatible upstream route. |
| [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) — unsound `glib::VariantStrIter`, informational | Linux native dependency `glib` 0.18.5, pulled through Tauri's GTK 0.18 / WebKitGTK stack. | The affected iterator methods are present in the linked Linux dependency graph, but no call from LRCGET source or the inspected GTK/Tauri/WebKit source paths was found. No user-controlled LRCGET input path to these methods was identified. This does not affect the Windows MSI. | RustSec marks versions ≥0.20 patched. GTK 0.18 constrains this dependency to 0.18, and no 0.18.6 release is available. Fixing it safely requires an upstream GTK/Tauri stack migration or maintained backport. |

`npm audit --omit=dev` reports zero production dependency vulnerabilities. The full npm audit still lists seven affected package entries, representing the two development-only advisories above.

## RustSec maintenance warnings

These are unmaintained-crate warnings, not known vulnerabilities:

- `bincode` 2.0.1, `encoding` 0.2.33, and `unsafe-libyaml` 0.2.11 are in the runtime dependency graph through Lindera/Charabia or YAML processing. Word segmentation and YAML import/export can reach these libraries. No security advisory is currently reported for them. Replacing them safely needs compatible upstream support and focused language-segmentation and YAML round-trip tests; replacing only LRCGET's direct YAML use would leave Lindera's transitive dependency.
- `paste` 1.0.15 (Lofty) and `proc-macro-error` 1.0.4 (GLib macros) are build-time procedural macro dependencies. They are not runtime code in packaged applications and have no known security advisory.

## Verification record

The checked-in notice set has 581 components and zero unreviewed licenses. Final Windows MSI and Linux package workflows both passed on commit `8d69074f29e8c3119450102a4f1a5af23199597f` on 2026-10-13. Linux passed 567 frontend tests, 88 native tests (2 ignored), 18 alignment Python tests, Ruff, DEB/AppImage builds and startup, upgrade/install/removal checks, and package license checks. Windows passed 567 frontend tests, 86 native tests (2 ignored), 18 alignment Python tests, Ruff, MSI build, upgrade/install/removal checks, and artifact upload.

- [Linux DEB/AppImage workflow](https://github.com/scriptusscript777/lrcget/actions/runs/38481382449)
- [Windows MSI workflow](https://github.com/scriptusscript777/lrcget/actions/runs/38481382542)

The MSI remains unsigned, and the development-only Tailwind advisories, GLib informational advisory, and unmaintained-crate notices described above remain visible.

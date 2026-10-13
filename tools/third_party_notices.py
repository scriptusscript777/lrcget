#!/usr/bin/env python3
"""Generate THIRD_PARTY_NOTICES.md for the components distributed in LRCGET installers.

Sources:
- Rust crates compiled into the app: `cargo about generate --format json` with
  tools/about.toml (Linux and Windows x64 targets, no build or dev dependencies).
  Install with `cargo install --locked cargo-about --features cli`.
- JavaScript packages: production dependencies in package-lock.json, with license
  files read from node_modules (run `npm ci` first).
- With --appimage: the shared libraries bundled inside the AppImage, mapped to
  their Debian packages and copyright files (run where those packages are installed).
- Fixed entries for the WebView2 bootstrapper in the Windows MSI.

Every license is classified as permissive, reviewed (with its obligation), or
unreviewed. --check exits with an error if anything is unreviewed, so the release
workflow stops until a person reviews it.

Usage (repository root): python3 tools/third_party_notices.py [--appimage FILE] [--output FILE] [--check]
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP_CRATE = "lrcget"

# Licenses whose only obligation is keeping the notice, which this file does.
PERMISSIVE = {
    "MIT",
    "MIT-0",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Zlib",
    "Unicode-3.0",
    "Unicode-DFS-2016",
    "CC0-1.0",
    "BSL-1.0",
    "0BSD",
    "bzip2-1.0.6",
    "NCSA",
    "CDLA-Permissive-2.0",
    "Unlicense",
    "BlueOak-1.0.0",
    "Python-2.0",
    "OpenSSL",
}
# Licenses reviewed for this project, with what distribution requires.
REVIEWED = {
    "MPL-2.0": "File-level copyleft. The crates are used unmodified; their source is available "
    "from crates.io and in the LRCGET source archive.",
    "LGPL-2.0-or-later": "Bundled in the AppImage only, as unmodified shared libraries from Ubuntu "
    "24.04 that can be replaced. Source: Ubuntu source packages listed below.",
    "LGPL-2.1-or-later": "Bundled in the AppImage only, as unmodified shared libraries from Ubuntu "
    "24.04 that can be replaced. Source: Ubuntu source packages listed below.",
    "LGPL-3.0-or-later": "Bundled in the AppImage only, as unmodified shared libraries from Ubuntu "
    "24.04 that can be replaced. Source: Ubuntu source packages listed below.",
    "Debian-copyright": "System library bundled in the AppImage; its Debian copyright file is "
    "reproduced below. Source: the Ubuntu source package listed.",
    "Microsoft-WebView2-Bootstrapper": "Microsoft redistributable included by the Tauri MSI to "
    "download WebView2 when it is missing; covered by Microsoft's WebView2 distribution terms.",
}


# Packages whose license (from package.json/README) was reviewed but that ship no
# license file; the standard text is reproduced with the stated author.
NO_LICENSE_FILE = {"vue-resize", "@iconify-json/mdi"}
# Development packages whose content is copied into the shipped web bundle.
BUNDLED_BUILD_PACKAGES = {
    "tailwindcss": "base styles (Preflight) in the app's CSS",
    "vite": "module-preload helper in the app's JavaScript",
    "@iconify-json/mdi": "Material Design Icons embedded as SVG",
}
MIT_TEMPLATE = """MIT License

Copyright (c) {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""


def name_of(path):
    return path.split("node_modules/")[-1]


def split_expression(expression):
    """Return the alternatives of an SPDX expression; each is a list of licenses that all apply."""
    expression = expression.replace("(", " ").replace(")", " ")
    alternatives = re.split(r"\s+OR\s+", expression.strip())
    return [
        [part.strip() for part in re.split(r"\s+AND\s+", alt) if part.strip()]
        for alt in alternatives
        if alt.strip()
    ]


def classify(expression):
    """'permissive', 'reviewed' or 'unreviewed' for the best alternative of an SPDX expression."""
    best = "unreviewed"
    for licenses in split_expression(expression or ""):
        if all(lic in PERMISSIVE for lic in licenses):
            return "permissive"
        if all(lic in PERMISSIVE or lic in REVIEWED for lic in licenses):
            best = "reviewed"
    return best


def rust_components():
    result = subprocess.run(
        [
            "cargo",
            "about",
            "generate",
            "--format",
            "json",
            "--config",
            "../tools/about.toml",
        ],
        cwd=ROOT / "src-tauri",
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(f"cargo about failed:\n{result.stderr}")
    data = json.loads(result.stdout)
    texts = {}
    for lic in data["licenses"]:
        for user in lic["used_by"]:
            crate = user["crate"]
            texts.setdefault((crate["name"], crate["version"]), []).append(
                (lic["id"], lic["text"])
            )
    components = []
    for entry in data["crates"]:
        package = entry["package"]
        if package["name"] == APP_CRATE:
            continue
        key = (package["name"], package["version"])
        components.append(
            {
                "name": f"{package['name']} {package['version']}",
                "license": entry.get("license")
                or package.get("license")
                or "NOASSERTION",
                "source": package.get("repository")
                or f"https://crates.io/crates/{package['name']}",
                "texts": texts.get(key, []),
            }
        )
    return sorted(components, key=lambda c: c["name"])


def js_components():
    lock = json.loads((ROOT / "package-lock.json").read_text())
    components = []
    for path, info in sorted(lock["packages"].items()):
        if not path.startswith("node_modules/"):
            continue
        # Only the top-level copy is used by the app build (nested copies serve tools).
        bundled_build = BUNDLED_BUILD_PACKAGES.get(path.removeprefix("node_modules/"))
        if (info.get("dev") or info.get("devOptional")) and not bundled_build:
            continue
        folder = ROOT / path
        meta_file = folder / "package.json"
        if not meta_file.exists():
            sys.exit(f"{folder} is missing; run `npm ci` first.")
        meta = json.loads(meta_file.read_text())
        license_id = meta.get("license") or info.get("license") or "NOASSERTION"
        if isinstance(license_id, dict):
            license_id = license_id.get("type", "NOASSERTION")
        # Every license file the package ships (e.g. LICENSE_MIT and LICENSE_APACHE-2.0).
        texts = [
            (f.name, f.read_text(errors="replace").strip())
            for f in sorted(folder.iterdir())
            if f.is_file() and re.match(r"(?i)(licen[cs]e|copying|notice)", f.name)
        ]
        if not texts and name_of(path) in NO_LICENSE_FILE:
            info_file = folder / "info.json"  # Iconify sets record the icon author here
            author = meta.get("author") or (
                json.loads(info_file.read_text()).get("author")
                if info_file.exists()
                else None
            )
            if isinstance(author, dict):
                author = author.get("name")
            holder = author or name_of(path)
            if license_id == "MIT":
                text = MIT_TEMPLATE.format(holder=holder)
            elif license_id == "Apache-2.0":
                text = (
                    f"Copyright {holder}\n\n"
                    + (ROOT / "tools/licenses/Apache-2.0.txt").read_text().strip()
                )
            else:
                sys.exit(
                    f"No license text template for {name_of(path)} ({license_id})."
                )
            texts = [
                (f"{license_id} (standard text; package ships no license file)", text)
            ]
        repo = meta.get("repository")
        if isinstance(repo, dict):
            repo = repo.get("url")
        name = name_of(path)
        components.append(
            {
                "name": f"{name} {meta.get('version', info.get('version', ''))}"
                + (f" — {bundled_build}" if bundled_build else ""),
                "license": license_id,
                "source": repo or f"https://www.npmjs.com/package/{name}",
                "texts": texts,
            }
        )
    return components


def appimage_components(appimage):
    """Map shared libraries bundled in the AppImage to Debian packages and copyright files."""
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [str(pathlib.Path(appimage).resolve()), "--appimage-extract"],
            cwd=tmp,
            check=True,
            capture_output=True,
        )
        libs = sorted(
            {
                p.name
                for p in pathlib.Path(tmp, "squashfs-root").rglob("*.so*")
                if p.is_file()
            }
        )
    packages = {}
    for lib in libs:
        found = subprocess.run(
            ["dpkg", "-S", lib], capture_output=True, text=True, check=False
        )
        if found.returncode != 0:
            packages.setdefault("(not from a Debian package)", set()).add(lib)
            continue
        package = found.stdout.split(":", 1)[0].split(",")[0].strip()
        packages.setdefault(package, set()).add(lib)
    components = []
    for package, files in sorted(packages.items()):
        copyright_file = (
            pathlib.Path("/usr/share/doc") / package.split(":")[0] / "copyright"
        )
        text = (
            copyright_file.read_text(errors="replace").strip()
            if copyright_file.exists()
            else None
        )
        source = subprocess.run(
            ["dpkg-query", "-W", "-f", "${source:Package} ${Version}", package],
            capture_output=True,
            text=True,
            check=False,
        ).stdout.strip()
        license_id = "Debian-copyright" if text else "NOASSERTION"
        if text and re.search(r"\bLGPL-?3", text):
            license_id = "LGPL-3.0-or-later AND Debian-copyright"
        elif text and re.search(r"\bLGPL", text):
            license_id = "LGPL-2.1-or-later AND Debian-copyright"
        components.append(
            {
                "name": f"{package} ({', '.join(sorted(files)[:4])}{' …' if len(files) > 4 else ''})",
                "license": license_id,
                "source": f"Ubuntu source package {source}"
                if source
                else "unknown source package",
                "texts": [("Debian copyright", text)] if text else [],
            }
        )
    return components


WINDOWS_COMPONENTS = [
    {
        "name": "Microsoft Edge WebView2 bootstrapper (Windows MSI only)",
        "license": "Microsoft-WebView2-Bootstrapper",
        "source": "https://developer.microsoft.com/microsoft-edge/webview2/",
        "texts": [],
    }
]


def render(sections, problems):
    lines = [
        "# Third-party notices",
        "",
        "LRCGET installers include the components below. Each keeps its own license, and",
        "their copyright and permission notices are reproduced here. LRCGET itself is",
        "covered by [LICENSE](LICENSE). This file is generated by",
        "`tools/third_party_notices.py`; the release workflow regenerates it for each release.",
        "",
        "Only components distributed inside LRCGET installers are listed. The Debian package",
        "uses WebKitGTK, GTK and other libraries already provided by the user's Linux system,",
        "and the Windows MSI uses the system's Microsoft Edge WebView2 runtime; those are not",
        "redistributed and are not listed. The AppImage carries some system libraries inside",
        "it; the copy inside the AppImage and the one attached to each GitHub release list",
        "them in their own section. Installed copies keep this file in",
        "`/usr/share/doc/lrcget/` (Debian) or in `licenses/` next to the program",
        "(Windows, AppImage).",
        "",
        "## License review summary",
        "",
    ]
    counts = {}
    reviewed = {}
    for _, components in sections:
        for c in components:
            status = classify(c["license"])
            counts[status] = counts.get(status, 0) + 1
            if status == "reviewed":
                for licenses in split_expression(c["license"]):
                    for lic in licenses:
                        if lic in REVIEWED:
                            reviewed.setdefault(lic, []).append(c["name"])
    total = sum(counts.values())
    lines.append(
        f"{total} components: {counts.get('permissive', 0)} permissive, "
        f"{counts.get('reviewed', 0)} reviewed with obligations, "
        f"{counts.get('unreviewed', 0)} needing review."
    )
    lines.append("")
    for lic, names in sorted(reviewed.items()):
        lines += [
            f"- **{lic}** ({len(names)}): {REVIEWED[lic]}",
            f"  Components: {', '.join(sorted(set(names)))}",
        ]
    if problems:
        lines += ["", "**Needs review before release:**", ""] + [
            f"- {p}" for p in problems
        ]
    lines.append("")
    for title, components in sections:
        lines += [f"## {title}", ""]
        for c in components:
            lines += [
                f"### {c['name']}",
                "",
                f"License: {c['license']} · Source: {c['source']}",
                "",
            ]
            for label, text in c["texts"]:
                lines += [
                    f"<details><summary>{label} text</summary>",
                    "",
                    "```",
                    text,
                    "```",
                    "",
                    "</details>",
                    "",
                ]
            if not c["texts"]:
                lines += ["License text: see the component's source above.", ""]
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--appimage", help="AppImage to inspect for bundled system libraries"
    )
    parser.add_argument("--output", default=str(ROOT / "THIRD_PARTY_NOTICES.md"))
    parser.add_argument(
        "--check", action="store_true", help="fail if any license needs review"
    )
    parser.add_argument(
        "--compare",
        help="fail if this committed notices file differs from the generated one",
    )
    args = parser.parse_args()

    sections = [
        ("Rust crates", rust_components()),
        ("JavaScript packages", js_components()),
    ]
    if args.appimage:
        sections.append(
            (
                "AppImage system libraries (Linux AppImage only)",
                appimage_components(args.appimage),
            )
        )
    sections.append(("Windows installer components", WINDOWS_COMPONENTS))

    problems = []
    for title, components in sections:
        for c in components:
            if classify(c["license"]) == "unreviewed":
                problems.append(f"{title}: {c['name']} — license `{c['license']}`")
            elif not c["texts"] and title in ("Rust crates", "JavaScript packages"):
                problems.append(
                    f"{title}: {c['name']} — no license text found to reproduce"
                )

    # License files mix line endings; Git stores LF, so always generate LF.
    text = render(sections, problems).replace("\r\n", "\n").replace("\r", "\n")
    pathlib.Path(args.output).write_text(text, encoding="utf-8")
    print(
        f"Wrote {args.output}: {sum(len(c) for _, c in sections)} components, {len(problems)} needing review"
    )
    for problem in problems:
        print(f"  NEEDS REVIEW: {problem}")
    if args.compare and pathlib.Path(args.compare).read_text(encoding="utf-8") != text:
        sys.exit(
            f"{args.compare} is out of date; run `python3 tools/third_party_notices.py` and commit it."
        )
    if args.check and problems:
        sys.exit(
            "Unreviewed third-party licenses; review them and update REVIEWED in tools/third_party_notices.py."
        )


if __name__ == "__main__":
    main()

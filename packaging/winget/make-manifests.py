#!/usr/bin/env python3
"""Generate WinGet manifests for the fork's published LRCGET MSI.

Reads the MSI asset, its SHA256 and the MSI properties recorded by the
windows-msi.yml workflow, then writes the three WinGet manifest files
(version, installer, defaultLocale) under
manifests/<first letter>/<Publisher>/<Name>/<version>/ in the output folder.

Nothing is uploaded; submit the folder to microsoft/winget-pkgs yourself.
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

REPO = "scriptusscript777/lrcget"
MANIFEST_VERSION = "1.6.0"
SCHEMA = "https://aka.ms/winget-manifest.{kind}.1.6.0.schema.json"


def gh_json(*args):
    return json.loads(
        subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout
    )


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--tag", required=True, help="GitHub release tag, for example v2.2.8"
    )
    parser.add_argument(
        "--msi-properties",
        required=True,
        type=pathlib.Path,
        help="msi-properties.json from the windows-msi.yml run that built this MSI",
    )
    parser.add_argument(
        "--package-id",
        default="RickLidgett.LRCGET",
        help="WinGet PackageIdentifier (never the upstream LRCLIB.LRCGET)",
    )
    parser.add_argument("--out", default="winget-out", type=pathlib.Path)
    args = parser.parse_args()

    if args.package_id.lower() == "lrclib.lrcget":
        sys.exit(
            "LRCLIB.LRCGET belongs to the original project; use this fork's own identifier."
        )
    publisher_id, name_id = args.package_id.split(".", 1)

    release = gh_json(
        "release", "view", args.tag, "-R", REPO, "--json", "assets,tagName,url"
    )
    assets = {a["name"]: a for a in release["assets"]}
    msi = [n for n in assets if n.endswith("x64_en-US.msi")]
    if len(msi) != 1:
        sys.exit(f"Expected one x64 MSI in {args.tag}, found {msi}")
    msi = msi[0]
    sha_text = subprocess.run(
        [
            "gh",
            "release",
            "download",
            args.tag,
            "-R",
            REPO,
            "-p",
            msi + ".sha256",
            "-O",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    sha256 = sha_text.split()[0].upper()
    if not re.fullmatch(r"[0-9A-F]{64}", sha256):
        sys.exit("Could not read the MSI SHA256 file from the release.")

    props = json.loads(args.msi_properties.read_text())
    version_match = re.search(r"(\d+\.\d+\.\d+)", args.tag)
    if not version_match:
        sys.exit("The release tag must contain a version such as v2.2.8.")
    version = version_match.group(1)
    # MSI ProductVersion uses patch*1000 (2.2.7 -> 2.2.7000); confirm it matches the tag.
    major, minor, patch = (int(p) for p in version.split("."))
    if props["ProductVersion"] != f"{major}.{minor}.{patch * 1000}":
        sys.exit(
            f"MSI ProductVersion {props['ProductVersion']} does not match tag version {version}."
        )

    url = f"https://github.com/{REPO}/releases/download/{args.tag}/{msi}"
    folder = (
        args.out
        / "manifests"
        / publisher_id[0].lower()
        / publisher_id
        / name_id
        / version
    )
    folder.mkdir(parents=True, exist_ok=True)
    header = "# Created by packaging/winget/make-manifests.py\n# yaml-language-server: $schema={}\n\n"

    files = {
        f"{args.package_id}.yaml": (
            SCHEMA.format(kind="version"),
            f"""PackageIdentifier: {args.package_id}
PackageVersion: {version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: {MANIFEST_VERSION}
""",
        ),
        f"{args.package_id}.installer.yaml": (
            SCHEMA.format(kind="installer"),
            f"""PackageIdentifier: {args.package_id}
PackageVersion: {version}
MinimumOSVersion: 10.0.17763.0
InstallerType: wix
Scope: machine
InstallModes:
- interactive
- silent
- silentWithProgress
UpgradeBehavior: install
ProductCode: '{props["ProductCode"]}'
AppsAndFeaturesEntries:
- DisplayName: LRCGET
  Publisher: {props["Manufacturer"]}
  ProductCode: '{props["ProductCode"]}'
  UpgradeCode: '{props["UpgradeCode"]}'
Installers:
- Architecture: x64
  InstallerUrl: {url}
  InstallerSha256: {sha256}
ManifestType: installer
ManifestVersion: {MANIFEST_VERSION}
""",
        ),
        f"{args.package_id}.locale.en-US.yaml": (
            SCHEMA.format(kind="defaultLocale"),
            f"""PackageIdentifier: {args.package_id}
PackageVersion: {version}
PackageLocale: en-US
Publisher: {props["Manufacturer"]}
PublisherUrl: https://github.com/scriptusscript777
PublisherSupportUrl: https://github.com/{REPO}/issues
Author: Rick Lidgett
PackageName: LRCGET (Rick Lidgett's enhanced build)
PackageUrl: https://github.com/{REPO}
License: MIT
LicenseUrl: https://github.com/{REPO}/blob/local/editor-lrc-default/LICENSE
ShortDescription: Desktop editor for synced and word-timed lyrics (LRC/ELRC) for your offline music library.
Description: An independent fork of LRCGET that adds a waveform lyrics editor, word timing, Enhanced LRC export and update alerts. Downloads and publishes lyrics through LRCLIB.
Moniker: lrcget
Tags:
- lrc
- lyrics
- music
- synced-lyrics
ReleaseNotesUrl: {release["url"]}
ManifestType: defaultLocale
ManifestVersion: {MANIFEST_VERSION}
""",
        ),
    }
    for name, (schema, body) in files.items():
        (folder / name).write_text(header.format(schema) + body, encoding="utf-8")
    print(folder)


if __name__ == "__main__":
    main()

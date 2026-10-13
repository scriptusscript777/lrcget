# Publishing LRCGET to WinGet

WinGet lets Windows users run `winget install RickLidgett.LRCGET` and
`winget upgrade RickLidgett.LRCGET`. The package does not exist yet. These steps
add it once; after that, the `release-winget.yml` workflow can submit new
versions automatically.

Do not use `LRCLIB.LRCGET`. That identifier belongs to the original project.

## Before you start

- Use a code-signed MSI (SignPath; see [code signing](../../docs/code-signing.md)).
  WinGet accepts unsigned installers, but Microsoft's validation and SmartScreen
  are smoother with a signed one.
- Use a plain release tag such as `v2.2.8`. The automatic workflow reads the
  version from the tag.
- Keep the `msi-properties.json` from the `windows-msi.yml` run that built the
  released MSI (it is in that run's `windows-msi-results` artifact). The MSI
  ProductCode changes with every build.

## 1. Generate the manifests (Linux or Windows)

```bash
gh run download <run-id> -R scriptusscript777/lrcget -n windows-msi-results -D msi-results
python3 packaging/winget/make-manifests.py --tag v2.2.8 \
  --msi-properties msi-results/msi-properties.json --out winget-out
```

The script reads the MSI and its SHA256 file from the GitHub release, checks that
the MSI version matches the tag, and writes three files to
`winget-out/manifests/r/RickLidgett/LRCGET/<version>/`. It uploads nothing.

## 2. Submit the first version (one time)

1. On GitHub, fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
   to your account.
2. Copy the generated `manifests/r/RickLidgett/LRCGET/<version>/` folder into the
   same path in your winget-pkgs fork, commit it on a new branch and open a pull
   request to `microsoft/winget-pkgs`. Title it `New package: RickLidgett.LRCGET version <version>`.
3. Microsoft's automated validation installs the MSI in a test machine. Answer any
   review comments on the pull request. Approval usually takes a few days.
4. Optional check on a Windows PC before submitting:
   `winget validate --manifest <folder>` and `winget install --manifest <folder>`.

## 3. Turn on automatic updates

1. Create a GitHub classic personal access token with the `public_repo` scope.
2. Add it to this fork as the Actions secret `WINGET_ACC_TOKEN`.
3. In `.github/workflows/release-winget.yml`, add the trigger
   `release: types: [released]` back above `workflow_dispatch:`.
4. Re-enable the workflow: `gh workflow enable release-winget.yml -R scriptusscript777/lrcget`.

Each new published release then opens a WinGet update pull request
automatically. Until then, start it manually from the Actions tab if needed.

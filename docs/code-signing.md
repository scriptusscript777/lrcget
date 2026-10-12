# Code signing policy and optional SignPath setup

## Current status

The 2.2.7 Windows MSI beta is unsigned. Application to SignPath Foundation is
pending; no certificate, approval, signing service or sponsorship is claimed.
The MIT license and upstream attribution remain. This repository is visibly an
independent fork. Upstream Windows signing status has not been verified and must
be disclosed when applying. [Foundation conditions](https://signpath.org/terms)
include special fork constraints, existing releases, MFA and manual release approval.
Acceptance is solely the Foundation's decision.

Rick Lidgett (@scriptusscript777) is the fork maintainer, committer/reviewer and
proposed signing approver. Changes from other contributors require review.
[Privacy and network behavior](privacy.md) describes local processing and requested
server, dependency/model and WebView2 downloads. Never publish API credentials.

## Configuration after approval

1. Apply at https://signpath.org/apply with the fork/release and honest reputation.
2. Follow Foundation onboarding, MFA, team roles and repository/GitHub App integration.
3. Obtain the approved organization, project, signing policy and artifact configuration.
   Use a ZIP artifact containing one MSI. Configure signing of this fork's LRCGET.exe
   inside the MSI and then the MSI itself. Enforce product/version metadata using
   the actual Windows PE metadata and approved artifact rules. Do not re-sign upstream
   WebView2/third-party files as this project. See the official
   [GitHub integration](https://docs.signpath.io/trusted-build-systems/github) and
   [artifact examples](https://docs.signpath.io/artifact-configuration/examples).
4. Store `SIGNPATH_API_TOKEN` in GitHub Actions secrets. Set repository variables
   `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`
   and `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`. Never put the token in source/docs.
5. Open Actions → Build and check Windows MSI → Run workflow. Select a reviewed
   branch and enable `sign_msi` only after configuration/approval. It defaults off.
6. The workflow first validates an unsigned build, uploads MSI-only signing input,
   and uses the pinned SignPath v3 action to request signing. Approve through SignPath.
   Missing settings or signing failure fail the run; they do not produce a signed release.
7. Signed output remains separate from unsigned diagnostics. Checksums are recomputed
   after signing, trusted signatures are required on MSI and installed LRCGET.exe,
   and Defender/install/repair/launch/uninstall checks run again. Only successful
   signed results should be labeled signed. The workflow never publishes automatically.
8. After approval, update the public policy/release pages with the Foundation's
   required attribution and actual signing status. Verify the signed download again.

This opt-in integration has been reviewed/parsed locally; an actual signing request
cannot be tested without Foundation approval and credentials. No model/package
installation is triggered by signing. Signing does not guarantee immediate
SmartScreen reputation or bypass Windows organizational security policies.

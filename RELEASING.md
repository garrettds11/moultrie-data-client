# Releasing Moultrie data client

Release packaging is automated by `.github/workflows/release.yml`.

The workflow is intentionally implemented without third-party or GitHub-owned reusable actions because this repository's Actions policy only permits actions owned by `garrettds11`. It uses shell commands, `git`, `zip`, and the GitHub CLI available on the GitHub-hosted runner.

## What the release ZIP contains

The generated ZIP is intentionally limited to files needed to run the unpacked Chrome extension, plus the GPL license:

- `manifest.json`
- `background.js`
- `bridge-main.js`
- `content.js`
- `popup.html`
- `popup.js`
- `popup.css`
- `help.html`
- `help.css`
- `LICENSE`

It does not include `.git`, repository history, the README, GitHub workflow files, the project logo, or other repository-only material.

## Create a release

### Manual release from GitHub Actions

1. Make sure `manifest.json` contains the intended version, for example `0.5.0`.
2. Commit and push the finished version to `main`.
3. Open **Actions → Build release package → Run workflow**.
4. The workflow builds `moultrie-data-client-v0.5.0.zip`, creates tag `v0.5.0` if needed, and creates the matching GitHub Release. If the release already exists, the ZIP asset is replaced with the newly built package.

### Release by pushing a tag

You can also create and push a matching version tag:

```bash
git tag v0.5.0
git push origin v0.5.0
```

The workflow verifies that the pushed tag matches the version in `manifest.json`, then builds the ZIP and creates or updates the matching GitHub Release.

## Installing a release ZIP

1. Download the release ZIP from GitHub Releases.
2. Extract it to a permanent local folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.

# Releasing Moultrie data client

Release packaging is automated by `.github/workflows/release.yml`.

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

It does not include `.git`, repository history, the README, GitHub workflow files, or other repository-only material.

## Create a release

1. Make sure `manifest.json` contains the intended version, for example `0.5.0`.
2. Commit and push the finished version to `main`.
3. Create and push a matching tag:

   ```bash
   git tag v0.5.0
   git push origin v0.5.0
   ```

4. GitHub Actions will build `moultrie-data-client-v0.5.0.zip` and create/update the GitHub Release for that tag with generated release notes.

The workflow can also be run manually from the **Actions** tab using **Build release package → Run workflow**. A manual run produces a downloadable workflow artifact but does not create a GitHub Release because no release tag is present.

## Installing a release ZIP

1. Download the release ZIP from GitHub Releases.
2. Extract it to a permanent local folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.

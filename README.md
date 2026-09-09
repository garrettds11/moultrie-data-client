![Data Client for Moultrie Web App](https://github.com/garrettds11/moultrie-data-client/blob/main/data-client-logo.png)

# Moultrie data client

A developer-mode Chrome extension that collects structured gallery metadata from the Moultrie Mobile web application, keeps a local reconciled copy in IndexedDB, and exports the data for analysis in tools such as Splunk, Excel, or Python.

> **Community project:** This project is not affiliated with, sponsored by, or endorsed by Moultrie Mobile. It uses the web application's authenticated API session and may require maintenance if Moultrie changes its web application or API behavior.

## Current version

**v0.5.0**

The extension is intentionally a **data acquisition and export client**. It does not perform hunting analytics, encounter grouping, weather enrichment, charting, or predictive scoring.

## Features

- Uses the current authenticated Moultrie web session; no password is entered into the extension.
- Reconciles the full gallery page by page.
- Stores records locally in Chrome IndexedDB keyed by Moultrie image ID.
- Reports **New / Updated / Unchanged** records on each sync.
- Preserves the full Moultrie server record for later use.
- Exports:
  - **Photos CSV** — one row per photo record.
  - **Detections CSV** — one row per `irTags` / `smartCaptureTags` detection.
  - **Full JSON** — highest-fidelity export of stored records and sync metadata.
- Does not download image or video files during gallery synchronization.
- Includes an in-extension Help page documenting every interactive control and status field.

## Install in Chrome developer mode

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open `https://web.moultriemobile.com` and log in normally.
7. Open or reload the Moultrie gallery and wait for it to finish loading.
8. Open **Moultrie data client**. `API auth` should show **Ready**.
9. Click **Sync gallery**.

When updating a local checkout, pull the new files and click **Reload** for the unpacked extension on `chrome://extensions`.

## Typical workflow

1. Leave the Moultrie cloud gallery as the source of truth.
2. Click **Sync gallery** whenever new camera uploads are expected or when Moultrie-side metadata may have changed.
3. Review the sync summary:
   - **New** — image IDs not previously stored locally.
   - **Updated** — existing image IDs whose server record changed.
   - **Unchanged** — existing records whose server data matched the local copy.
4. Export CSV or JSON for downstream processing.

A camera upload that arrives a few hours after your previous sync will simply appear as **New** on the next sync. The extension performs a full reconciliation so it can also catch changes to older records.

## Popup controls

| Control / field | What it does |
| --- | --- |
| **Help** | Opens the complete instruction page in a new tab. |
| **API auth** | Shows whether the API context required for Moultrie gallery requests has been captured. |
| **Records stored** | Shows the number of locally stored photo records. |
| **Last sync** | Shows the local completion time of the last successful sync. |
| **Sync** | Shows Idle, Running, Complete, or Error. |
| **New / Updated / Unchanged** | Shows the result of the most recent reconciliation. |
| **Sync gallery** | Contacts the Moultrie API and reconciles the full gallery into local IndexedDB. |
| **Export photos CSV** | Downloads one flattened row per photo. |
| **Export detections CSV** | Downloads one row per returned detection. |
| **Export full JSON** | Downloads the highest-fidelity stored dataset. |
| **Refresh status** | Re-reads and redraws local extension state only. **It does not contact Moultrie or start a sync.** |
| **Clear local data** | Deletes local records and sync history after confirmation; it does not delete Moultrie cloud data. |

See **Help** inside the extension for more detail.

## Local storage model

Collected gallery records are stored in IndexedDB under the extension origin in the current Chrome profile. On Windows, Chrome profile data normally lives under `%LOCALAPPDATA%\Google\Chrome\User Data\<Profile>`, although Chrome manages the underlying IndexedDB/LevelDB files and their names.

Extension state and the captured API request context are stored using `chrome.storage.local`.

### Clearing data

**Clear local data** clears the collected IndexedDB records and local sync history. It deliberately retains the current captured API session headers. If those headers are still valid, another sync can run immediately.

After clearing, the extension has no local record keys to reconcile against, so the next sync reports all current cloud gallery records as **New** and rebuilds the local database.

## Authentication and security

Moultrie Mobile currently uses an authenticated web session. The extension observes the request context used by the Moultrie web application and locally retains the headers required to call the gallery API, including a session bearer token when present.

- The extension does **not** collect your Moultrie password.
- Authentication headers are not included in CSV or JSON exports.
- Session material is stored locally in the Chrome profile.
- Logging out or session expiration can invalidate the captured API authentication.

Because this depends on an undocumented web API, endpoint names, headers, response schemas, or authentication behavior may change without notice.

## Data model

The canonical local record grain is **one Moultrie image record** keyed by its Moultrie image ID. The full API object is retained, with local bookkeeping fields used to track first collection and later changes.

The normalized Photos CSV currently includes fields such as capture/storage timestamps, camera identity, folder, temperature, wind fields, moon phase, pressure, coordinates, displayed tags, detector tag names, game-profile IDs, media flags, filenames, URLs, and local collection timestamps.

The Detections CSV expands the nested `irTags` and `smartCaptureTags` arrays into one row per detection and preserves probability and bounding-box fields where provided.

## Project scope

Keep collection concerns here; perform analytics elsewhere. Good downstream responsibilities include:

- encounter/session grouping and duration
- weather and solar enrichment
- location/deployment corrections
- trend and seasonality analysis
- visualization
- predictive hunt planning

This separation keeps the browser extension small, auditable, and reliable.

## Development

This is a Manifest V3 extension written in plain HTML, CSS, and JavaScript with no build step and no third-party runtime dependencies.

Main files:

- `manifest.json` — Chrome extension manifest
- `background.js` — API sync, IndexedDB storage, reconciliation, export, and messaging
- `popup.html` / `popup.js` / `popup.css` — extension popup
- `help.html` / `help.css` — user documentation

## Version history

### v0.5.0

- Expanded Help so every user-facing popup control and status field is documented.
- Added explicit documentation for **Refresh status** and clarified that it does not contact Moultrie or trigger synchronization.
- Added authentication, privacy, storage, troubleshooting, and update guidance.
- Added public-project README and GPL-3.0 licensing.

### v0.4.0

- Added full-gallery reconciliation with New / Updated / Unchanged counts.
- Added Last sync and improved diagnostics.
- Expanded normalized Photos CSV source fields.
- Added Help page and documented clear/repopulate behavior.

## License

Licensed under the **GNU General Public License v3.0**. See [LICENSE](LICENSE).

GPL-3.0 permits anyone to use, study, modify, and redistribute this software while requiring distributed derivative works to remain under the same free-software license.

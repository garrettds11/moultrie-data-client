# Moultrie data client v0.4

Developer-mode Chrome extension for collecting structured Moultrie gallery metadata.

## Install / update
1. Extract this folder.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Remove the older unpacked copy or point **Load unpacked** at this v0.4 folder.
5. Open `https://web.moultriemobile.com`, log in, and open/reload the gallery.
6. Wait for the gallery thumbnails to load.
7. Open the extension. `API auth` should show **Ready**.
8. Click **Sync gallery**.

## v0.4 changes
- Full-gallery reconciliation now reports **New / Updated / Unchanged** records.
- Existing image IDs are updated only when the Moultrie server record changed.
- Added **Last sync** and clearer sync diagnostics.
- Photos CSV now includes useful source fields such as `type`, `status`, `isTestImage`, `isManual`, `forSecurity`, and folder name for downstream filtering.
- Full JSON includes the last-sync summary.
- Added a **Help** page explaining usage, storage, clearing, and later sync behavior.
- Clearing local data removes collected records and sync history but deliberately retains the current captured API session headers. The next sync repopulates the local database and treats all current gallery records as new.

## Scope
This extension is intentionally a collection/export client. It does not perform encounter grouping, enrichment, charting, or predictive analytics.

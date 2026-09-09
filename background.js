const DB_NAME = 'moultrieDataClient';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';
const META_STORE = 'meta';
const API_URL = 'https://consumerapi-web-v2.moultriemobile.com/api/v2/Image/ImageSearch';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const photos = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
        photos.createIndex('takenOn', 'takenOn', { unique: false });
        photos.createIndex('cameraId', 'cameraId', { unique: false });
        photos.createIndex('cameraName', 'cameraName', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function stripInternal(record) {
  if (!record || typeof record !== 'object') return record;
  const clone = { ...record };
  delete clone._collectedAt;
  delete clone._firstCollectedAt;
  delete clone._lastChangedAt;
  return clone;
}

function sameServerRecord(a, b) {
  return JSON.stringify(stripInternal(a)) === JSON.stringify(stripInternal(b));
}

async function getAllPhotos() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PHOTO_STORE], 'readonly');
    const req = tx.objectStore(PHOTO_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function upsertPhotos(records, existingMap = null) {
  if (!Array.isArray(records) || records.length === 0) {
    return { newCount: 0, updatedCount: 0, unchangedCount: 0, processedCount: 0 };
  }

  const map = existingMap || new Map((await getAllPhotos()).map(r => [r.id, r]));
  const now = new Date().toISOString();
  const writes = [];
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const record of records) {
    if (!record?.id) continue;
    const prior = map.get(record.id);

    if (!prior) {
      const next = {
        ...record,
        _firstCollectedAt: now,
        _lastChangedAt: now,
        _collectedAt: now
      };
      writes.push(next);
      map.set(record.id, next);
      newCount++;
      continue;
    }

    if (sameServerRecord(prior, record)) {
      // Preserve the stored server record exactly as last written. We intentionally do
      // not update _collectedAt for unchanged records so exports remain stable.
      unchangedCount++;
      continue;
    }

    const next = {
      ...record,
      _firstCollectedAt: prior._firstCollectedAt || prior._collectedAt || now,
      _lastChangedAt: now,
      _collectedAt: now
    };
    writes.push(next);
    map.set(record.id, next);
    updatedCount++;
  }

  if (writes.length) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([PHOTO_STORE], 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      for (const record of writes) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    newCount,
    updatedCount,
    unchangedCount,
    processedCount: newCount + updatedCount + unchangedCount
  };
}

async function setMeta(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE], 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMeta(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE], 'readonly');
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function clearCollectedData() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PHOTO_STORE, META_STORE], 'readwrite');
    tx.objectStore(PHOTO_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let s = Array.isArray(value) ? value.join(';') : String(value);
  if (/[",\n\r]/.test(s)) s = '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function tagNames(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.map(t => t?.Name ?? t?.name ?? '').filter(Boolean).join(';');
}

function gameProfileIds(record) {
  const ids = record?.GameProfileIds ?? record?.gameProfileIds ?? [];
  return Array.isArray(ids) ? ids.join(';') : String(ids ?? '');
}

function folderName(record) {
  return record?.folder?.Name ?? record?.folder?.name ?? '';
}

function buildPhotosCsv(records) {
  const headers = [
    'id','takenOn','storedOn','cameraId','cameraName','folderName','modemMEID',
    'type','status','temperature','windDirection','windDirectionDegrees','windSpeedKph',
    'moonPhase','pressure','latitude','longitude','smartTags','irTags','smartCaptureTags',
    'gameProfileIds','flash','isFavorite','isVideo','isTestImage','isManual','forSecurity',
    'captureReason','burstSequenceId','fileName','localFileName','imageUrl','downloadUrl',
    'firstCollectedAt','lastChangedAt','collectedAt'
  ];
  const rows = [headers.join(',')];
  for (const r of records) {
    const row = {
      id: r.id,
      takenOn: r.takenOn,
      storedOn: r.storedOn,
      cameraId: r.cameraId,
      cameraName: r.cameraName,
      folderName: folderName(r),
      modemMEID: r.modemMEID ?? r.meid,
      type: r.type,
      status: r.status,
      temperature: r.temperature,
      windDirection: r.windDirection,
      windDirectionDegrees: r.windDirectionDegrees,
      windSpeedKph: r.windSpeedKph,
      moonPhase: r.moonPhase,
      pressure: r.pressure,
      latitude: r.latitude,
      longitude: r.longitude,
      smartTags: r.CommaSeparatedTags ?? r.commaSeparatedTags ?? '',
      irTags: tagNames(r.irTags),
      smartCaptureTags: tagNames(r.smartCaptureTags),
      gameProfileIds: gameProfileIds(r),
      flash: r.flash,
      isFavorite: r.isFavorite,
      isVideo: r.isVideo,
      isTestImage: r.isTestImage,
      isManual: r.isManual,
      forSecurity: r.forSecurity,
      captureReason: r.captureReason,
      burstSequenceId: r.BurstSequenceId ?? r.burstSequenceId,
      fileName: r.fileName,
      localFileName: r.localFileName,
      imageUrl: r.imageUrl,
      downloadUrl: r.downloadUrl,
      firstCollectedAt: r._firstCollectedAt,
      lastChangedAt: r._lastChangedAt,
      collectedAt: r._collectedAt
    };
    rows.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  return rows.join('\r\n');
}

function buildDetectionsCsv(records) {
  const headers = [
    'photoId','takenOn','cameraId','cameraName','source','name','displayName','probability',
    'boundingboxLeft','boundingboxTop','boundingboxWidth','boundingboxHeight','tagId'
  ];
  const rows = [headers.join(',')];
  for (const r of records) {
    const sources = [
      ['irTags', r.irTags],
      ['smartCaptureTags', r.smartCaptureTags]
    ];
    for (const [source, detections] of sources) {
      if (!Array.isArray(detections)) continue;
      for (const d of detections) {
        const row = {
          photoId: r.id,
          takenOn: r.takenOn,
          cameraId: r.cameraId,
          cameraName: r.cameraName,
          source,
          name: d?.Name ?? d?.name,
          displayName: d?.DisplayName ?? d?.displayName,
          probability: d?.Probability ?? d?.probability,
          boundingboxLeft: d?.BoundingboxLeft ?? d?.boundingboxLeft,
          boundingboxTop: d?.BoundingboxTop ?? d?.boundingboxTop,
          boundingboxWidth: d?.BoundingboxWidth ?? d?.boundingboxWidth,
          boundingboxHeight: d?.BoundingboxHeight ?? d?.boundingboxHeight,
          tagId: d?.TagId ?? d?.tagId
        };
        rows.push(headers.map(h => csvEscape(row[h])).join(','));
      }
    }
  }
  return rows.join('\r\n');
}

async function updateStatus(patch) {
  const current = (await chrome.storage.local.get('syncStatus')).syncStatus || {};
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ syncStatus: next });
  chrome.runtime.sendMessage({ type: 'SYNC_STATUS', status: next }).catch(() => {});
}

async function syncGalleryDirect() {
  const stored = await chrome.storage.local.get('moultrieHeaders');
  const h = stored.moultrieHeaders || {};
  if (!h.userdeviceid || !h.authorization) {
    throw new Error('Moultrie API authentication was not fully captured. Reload the Moultrie gallery and wait for it to load, then try again.');
  }

  // Full reconciliation is intentional. It finds new photos and also picks up
  // server-side changes to older records such as tags or GameProfileIds.
  const existingRecords = await getAllPhotos();
  const existingMap = new Map(existingRecords.map(r => [r.id, r]));

  const pageSize = 48;
  let pageIndex = 0;
  let totalPages = 1;
  let totalAvailable = 0;
  let received = 0;
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  await updateStatus({
    running: true,
    done: false,
    error: null,
    diagnostic: 'Starting gallery reconciliation…',
    pageIndex: 0,
    totalPages: 0,
    received: 0,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0
  });

  do {
    const requestBody = {
      IsSharedGallery: false,
      RecycleBin: false,
      Order: 'TakenOnDescending',
      PageSize: pageSize,
      PageIndex: pageIndex
    };

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'accept': 'text/plain',
          'content-type': 'application/json-patch+json',
          'appdevicemodel': h.appdevicemodel || 'Chrome',
          'appos': h.appos || 'Browser',
          'appversion': h.appversion || 'BlazorConsumerSite',
          'userdeviceid': h.userdeviceid,
          'authorization': h.authorization
        },
        body: JSON.stringify(requestBody)
      });
    } catch (err) {
      throw new Error(`Network fetch failed before an HTTP response was received: ${err?.message || String(err)}`);
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`ImageSearch HTTP ${response.status} ${response.statusText || ''}: ${responseText.slice(0, 500)}`.trim());
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error(`ImageSearch returned non-JSON data on page ${pageIndex}: ${responseText.slice(0, 300)}`);
    }

    const container = json?.Results ?? json?.results ?? json;
    const records = container?.Results ?? container?.results ?? [];
    if (!Array.isArray(records)) {
      throw new Error(`Unexpected ImageSearch response shape on page ${pageIndex}.`);
    }

    totalPages = Number(container?.TotalPages ?? container?.totalPages ?? 1) || 1;
    totalAvailable = Number(container?.TotalAvailableCount ?? container?.totalAvailableCount ?? records.length) || records.length;

    const stats = await upsertPhotos(records, existingMap);
    received += records.length;
    newCount += stats.newCount;
    updatedCount += stats.updatedCount;
    unchangedCount += stats.unchangedCount;

    await updateStatus({
      running: true,
      pageIndex,
      totalPages,
      totalAvailable,
      received,
      newCount,
      updatedCount,
      unchangedCount,
      httpStatus: response.status,
      diagnostic: `HTTP ${response.status}; page ${pageIndex + 1}/${totalPages}. New ${newCount}, updated ${updatedCount}, unchanged ${unchangedCount}.`
    });

    pageIndex++;
  } while (pageIndex < totalPages);

  const finishedAt = new Date().toISOString();
  const totalStored = (await getAllPhotos()).length;
  const summary = {
    finishedAt,
    totalPages,
    totalAvailable,
    received,
    newCount,
    updatedCount,
    unchangedCount,
    totalStored
  };

  await setMeta('lastSync', finishedAt);
  await setMeta('lastSyncSummary', summary);
  await updateStatus({
    running: false,
    done: true,
    error: null,
    ...summary,
    pageIndex: Math.max(0, totalPages - 1),
    diagnostic: `Sync complete. New ${newCount}, updated ${updatedCount}, unchanged ${unchangedCount}. ${totalStored} records stored locally.`
  });

  return summary;
}

// Capture the browser-specific Moultrie request headers from normal web-app traffic.
chrome.webRequest.onBeforeSendHeaders.addListener(
  async details => {
    const headers = {};
    for (const h of details.requestHeaders || []) {
      const n = (h.name || '').toLowerCase();
      if (['userdeviceid','appdevicemodel','appos','appversion','authorization'].includes(n)) {
        headers[n] = h.value;
      }
    }
    if (headers.userdeviceid || headers.authorization) {
      const previous = (await chrome.storage.local.get('moultrieHeaders')).moultrieHeaders || {};
      await chrome.storage.local.set({
        moultrieHeaders: { ...previous, ...headers, capturedAt: new Date().toISOString() }
      });
    }
  },
  { urls: ['https://consumerapi-web-v2.moultriemobile.com/*'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'START_DIRECT_SYNC') {
      sendResponse({ ok: true, started: true });
      syncGalleryDirect().catch(async err => {
        await updateStatus({
          running: false,
          done: false,
          error: err?.message || String(err),
          diagnostic: err?.stack || err?.message || String(err)
        });
      });
      return;
    }

    if (msg?.type === 'SYNC_ERROR') {
      await updateStatus({ running: false, done: false, error: msg.error || 'Unknown sync error' });
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'GET_STATE') {
      const [photos, storage, lastSync, lastSyncSummary] = await Promise.all([
        getAllPhotos(),
        chrome.storage.local.get(['moultrieHeaders','syncStatus']),
        getMeta('lastSync'),
        getMeta('lastSyncSummary')
      ]);
      sendResponse({
        ok: true,
        count: photos.length,
        sessionDetected: Boolean(storage.moultrieHeaders?.userdeviceid && storage.moultrieHeaders?.authorization),
        deviceHeaderDetected: Boolean(storage.moultrieHeaders?.userdeviceid),
        bearerDetected: Boolean(storage.moultrieHeaders?.authorization),
        capturedAt: storage.moultrieHeaders?.capturedAt || null,
        lastSync,
        lastSyncSummary,
        syncStatus: storage.syncStatus || {}
      });
      return;
    }

    if (msg?.type === 'EXPORT') {
      const records = await getAllPhotos();
      records.sort((a,b) => String(a.takenOn || '').localeCompare(String(b.takenOn || '')));
      if (msg.format === 'photos-csv') {
        sendResponse({ ok: true, text: buildPhotosCsv(records), mime: 'text/csv', ext: 'csv', kind: 'photos' });
      } else if (msg.format === 'detections-csv') {
        sendResponse({ ok: true, text: buildDetectionsCsv(records), mime: 'text/csv', ext: 'csv', kind: 'detections' });
      } else {
        sendResponse({
          ok: true,
          text: JSON.stringify({
            exportedAt: new Date().toISOString(),
            lastSync: await getMeta('lastSync'),
            lastSyncSummary: await getMeta('lastSyncSummary'),
            records
          }, null, 2),
          mime: 'application/json',
          ext: 'json',
          kind: 'full'
        });
      }
      return;
    }

    if (msg?.type === 'CLEAR_DATA') {
      await clearCollectedData();
      await chrome.storage.local.remove('syncStatus');
      // Deliberately retain moultrieHeaders so clearing collected records does not
      // log the user out or require another auth capture when the token is still valid.
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'OPEN_HELP') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
      sendResponse({ ok: true });
      return;
    }
  })().catch(err => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

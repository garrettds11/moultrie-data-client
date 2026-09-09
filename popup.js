const $ = id => document.getElementById(id);
const sessionEl = $('session');
const countEl = $('count');
const lastSyncEl = $('lastSync');
const syncStateEl = $('syncState');
const detailEl = $('detail');
const progressWrap = $('progressWrap');
const progressEl = $('progress');
const syncBtn = $('sync');
const statsEl = $('stats');

async function runtimeMessage(msg) {
  return await chrome.runtime.sendMessage(msg);
}

function fmtDate(value) {
  if (!value) return 'Never';
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

async function refresh() {
  const state = await runtimeMessage({ type: 'GET_STATE' });
  if (!state?.ok) {
    detailEl.textContent = state?.error || 'Unable to read extension state.';
    return;
  }
  sessionEl.textContent = state.sessionDetected ? 'Ready' : (state.deviceHeaderDetected || state.bearerDetected ? 'Partial' : 'Not detected');
  countEl.textContent = Number(state.count || 0).toLocaleString();
  lastSyncEl.textContent = fmtDate(state.lastSync);
  renderStatus(state.syncStatus || state.lastSyncSummary || {});
}

function renderStats(s) {
  const hasStats = [s.newCount, s.updatedCount, s.unchangedCount].some(v => Number.isFinite(Number(v)));
  if (!hasStats) {
    statsEl.classList.add('hidden');
    return;
  }
  statsEl.classList.remove('hidden');
  $('newCount').textContent = Number(s.newCount || 0).toLocaleString();
  $('updatedCount').textContent = Number(s.updatedCount || 0).toLocaleString();
  $('unchangedCount').textContent = Number(s.unchangedCount || 0).toLocaleString();
}

function renderStatus(s) {
  renderStats(s);
  if (s.running) {
    syncStateEl.textContent = 'Running';
    syncBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    const total = Number(s.totalPages || 0);
    const page = Number(s.pageIndex ?? -1) + 1;
    const pct = total ? Math.min(100, Math.round((page / total) * 100)) : 0;
    progressEl.style.width = `${pct}%`;
    detailEl.textContent = s.diagnostic || `${Number(s.received || 0).toLocaleString()} records received${total ? ` • page ${page}/${total}` : ''}`;
  } else {
    syncBtn.disabled = false;
    progressWrap.classList.add('hidden');
    if (s.error) {
      syncStateEl.textContent = 'Error';
      detailEl.textContent = s.diagnostic && s.diagnostic !== s.error ? `${s.error}\n${s.diagnostic}` : s.error;
    } else if (s.done || s.finishedAt) {
      syncStateEl.textContent = 'Complete';
      detailEl.textContent = s.diagnostic || `Finished ${fmtDate(s.finishedAt)}`;
    } else {
      syncStateEl.textContent = 'Idle';
      detailEl.textContent = 'Open/reload the Moultrie gallery before syncing if API auth is not Ready.';
    }
  }
}

async function startSync() {
  detailEl.textContent = '';
  statsEl.classList.add('hidden');
  await chrome.storage.local.set({ syncStatus: {
    running: true,
    done: false,
    error: null,
    pageIndex: 0,
    totalPages: 0,
    received: 0,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    diagnostic: 'Starting…'
  }});
  renderStatus({ running: true, pageIndex: 0, totalPages: 0, received: 0 });

  try {
    const response = await runtimeMessage({ type: 'START_DIRECT_SYNC' });
    if (!response?.ok) throw new Error(response?.error || 'Unable to start sync.');
  } catch (err) {
    const error = err?.message || String(err);
    await chrome.runtime.sendMessage({ type: 'SYNC_ERROR', error }).catch(() => {});
    detailEl.textContent = error;
    syncBtn.disabled = false;
  }
}

async function downloadExport(format) {
  const r = await runtimeMessage({ type: 'EXPORT', format });
  if (!r?.ok) {
    detailEl.textContent = r?.error || 'Export failed.';
    return;
  }
  const blob = new Blob([r.text], { type: `${r.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replaceAll(':','-').replace(/\.\d{3}Z$/, 'Z');
  await chrome.downloads.download({ url, filename: `moultrie-${r.kind}-${stamp}.${r.ext}`, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

syncBtn.addEventListener('click', startSync);
$('refresh').addEventListener('click', refresh);
$('exportPhotos').addEventListener('click', () => downloadExport('photos-csv'));
$('exportDetections').addEventListener('click', () => downloadExport('detections-csv'));
$('exportJson').addEventListener('click', () => downloadExport('json'));
$('help').addEventListener('click', () => runtimeMessage({ type: 'OPEN_HELP' }));
$('clear').addEventListener('click', async () => {
  if (!confirm('Clear all locally collected Moultrie records and sync history? Your Moultrie account and cloud photos are not changed. The next sync will repopulate the local database from the gallery.')) return;
  const r = await runtimeMessage({ type: 'CLEAR_DATA' });
  if (r?.ok) await refresh();
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type === 'SYNC_STATUS') {
    renderStatus(msg.status || {});
    if (!msg.status?.running) refresh().catch(() => {});
  }
});

refresh().catch(err => { detailEl.textContent = err.message; });

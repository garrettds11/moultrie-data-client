chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'START_SYNC') return;

  chrome.runtime.sendMessage({ type: 'GET_MOULTRIE_HEADERS' }, response => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!response?.headers?.userdeviceid) {
      sendResponse({ ok: false, error: 'No Moultrie session detected. Reload the Moultrie gallery and try again.' });
      return;
    }
    window.postMessage({
      source: 'moultrie-data-client-content',
      type: 'START_SYNC',
      config: { headers: response.headers }
    }, '*');
    sendResponse({ ok: true });
  });
  return true;
});

window.addEventListener('message', event => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg?.source !== 'moultrie-data-client-main') return;

  if (msg.type === 'PAGE') {
    chrome.runtime.sendMessage({
      type: 'STORE_PAGE',
      records: msg.records,
      pageIndex: msg.pageIndex,
      totalPages: msg.totalPages,
      totalAvailable: msg.totalAvailable,
      storedSoFar: msg.storedSoFar
    }).catch(() => {});
  } else if (msg.type === 'DONE') {
    chrome.runtime.sendMessage({ type: 'SYNC_DONE', ...msg }).catch(() => {});
  } else if (msg.type === 'ERROR') {
    chrome.runtime.sendMessage({ type: 'SYNC_ERROR', error: msg.error }).catch(() => {});
  }
});

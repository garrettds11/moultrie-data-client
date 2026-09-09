(() => {
  if (window.__moultrieDataClientBridgeInstalled) return;
  window.__moultrieDataClientBridgeInstalled = true;

  const API = 'https://consumerapi-web-v2.moultriemobile.com/api/v2/Image/ImageSearch';

  function post(type, payload = {}) {
    window.postMessage({ source: 'moultrie-data-client-main', type, ...payload }, '*');
  }

  async function syncGallery(config) {
    const headers = config?.headers || {};
    if (!headers.userdeviceid) throw new Error('Moultrie session header not captured. Reload/open the Moultrie gallery first.');

    const pageSize = 48;
    let pageIndex = 0;
    let totalPages = 1;
    let totalAvailable = 0;
    let storedSoFar = 0;

    do {
      const response = await fetch(API, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'accept': 'text/plain',
          'content-type': 'application/json-patch+json',
          'appdevicemodel': headers.appdevicemodel || `Chrome ${navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || ''}`.trim(),
          'appos': headers.appos || 'Browser',
          'appversion': headers.appversion || 'BlazorConsumerSite',
          'userdeviceid': headers.userdeviceid
        },
        body: JSON.stringify({
          IsSharedGallery: false,
          RecycleBin: false,
          Order: 'TakenOnDescending',
          PageSize: pageSize,
          PageIndex: pageIndex
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ImageSearch failed (${response.status} ${response.statusText})${body ? ': ' + body.slice(0, 300) : ''}`);
      }

      const json = await response.json();
      const container = json?.Results ?? json?.results ?? json;
      const records = container?.Results ?? container?.results ?? [];
      totalPages = Number(container?.TotalPages ?? container?.totalPages ?? 1) || 1;
      totalAvailable = Number(container?.TotalAvailableCount ?? container?.totalAvailableCount ?? records.length) || records.length;
      storedSoFar += records.length;

      post('PAGE', { records, pageIndex, totalPages, totalAvailable, storedSoFar });
      post('PROGRESS', { pageIndex: pageIndex + 1, totalPages, totalAvailable, storedSoFar });
      pageIndex++;
    } while (pageIndex < totalPages);

    post('DONE', { totalPages, totalAvailable, storedSoFar });
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window || msg?.source !== 'moultrie-data-client-content') return;
    if (msg.type === 'START_SYNC') {
      syncGallery(msg.config).catch(error => post('ERROR', { error: error?.message || String(error) }));
    }
  });
})();

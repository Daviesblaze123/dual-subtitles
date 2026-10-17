// Dual Subtitles – page script.
// Runs in YouTube's own JavaScript context ("MAIN world") so it can talk to the
// video player and see the caption files the player downloads. It talks to the
// content script only through window.postMessage.

(() => {
  'use strict';

  const SOURCE = 'dual-subtitles';
  const post = (msg) => window.postMessage({ source: SOURCE, from: 'page', ...msg }, location.origin);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Capture caption files downloaded by the player ----------------------
  // YouTube only serves caption files to requests signed by the player itself,
  // so we listen in on those requests instead of downloading the file ourselves.

  function isCaptionUrl(url) {
    return typeof url === 'string' && url.includes('/api/timedtext');
  }

  // Kept so they can be replayed: the player may download captions before the
  // content script is listening (e.g. when German subtitles are already on).
  const captured = [];

  function reportCaption(url, text) {
    if (!text) return;
    const capture = { url: new URL(url, location.href).href, text };
    captured.push(capture);
    if (captured.length > 20) captured.shift();
    post({ type: 'captionData', ...capture });
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__dualSubsUrl = String(url);
    return xhrOpen.apply(this, arguments);
  };

  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (isCaptionUrl(this.__dualSubsUrl)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') reportCaption(this.__dualSubsUrl, this.responseText);
        } catch { /* ignore unreadable responses */ }
      });
    }
    return xhrSend.apply(this, arguments);
  };

  const pageFetch = window.fetch;
  window.fetch = function (input) {
    const promise = pageFetch.apply(this, arguments);
    const url = typeof input === 'string' ? input : input?.url;
    if (isCaptionUrl(url)) {
      promise.then((res) => res.clone().text()).then((text) => reportCaption(url, text)).catch(() => {});
    }
    return promise;
  };

  // --- Player helpers -------------------------------------------------------

  const getPlayer = () => document.getElementById('movie_player');

  function getTracks() {
    const response = getPlayer()?.getPlayerResponse?.() || window.ytInitialPlayerResponse;
    const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return {
      videoId: response?.videoDetails?.videoId || null,
      title: response?.videoDetails?.title || '',
      tracks: tracks.map((t) => ({
        languageCode: t.languageCode,
        kind: t.kind || '',
        baseUrl: t.baseUrl,
      })),
    };
  }

  // Switch the player to the given track; the player then downloads the file
  // and the hooks above pass it on to the content script.
  async function enableTrack({ languageCode, kind }) {
    const player = getPlayer();
    if (!player?.setOption) return;
    player.loadModule?.('captions');
    for (let i = 0; i < 20; i++) {
      const list = player.getOption?.('captions', 'tracklist', { includeAsr: true }) || [];
      const track = list.find((t) => t.languageCode === languageCode && (t.kind || '') === kind);
      if (track) {
        player.setOption('captions', 'track', track);
        return;
      }
      await sleep(250);
    }
    player.setOption('captions', 'track', { languageCode, kind });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (event.source !== window || msg?.source !== SOURCE || msg.from !== 'content') return;
    if (msg.type === 'getTracks') post({ type: 'tracks', requestId: msg.requestId, ...getTracks() });
    if (msg.type === 'enableTrack') enableTrack(msg.track);
    if (msg.type === 'replayCaptions') {
      captured.forEach((capture) => post({ type: 'captionData', ...capture }));
      post({ type: 'replayDone', requestId: msg.requestId });
    }
  });
})();

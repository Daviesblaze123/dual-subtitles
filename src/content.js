// Dual Subtitles – content script (runs on youtube.com).
// Ties the pieces together: detects the current video, loads its German
// captions and shows status messages.

(() => {
  'use strict';

  const DS = self.DualSubs;
  let badge = null;
  let session = 0; // bumps on every navigation so stale async work is ignored

  function currentVideoId() {
    if (location.pathname !== '/watch') return null;
    return new URLSearchParams(location.search).get('v');
  }

  function showBadge(text) {
    const player = document.getElementById('movie_player');
    if (!player) return;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ds-badge';
    }
    badge.textContent = text;
    if (badge.parentElement !== player) player.appendChild(badge);
  }

  function removeBadge() {
    badge?.remove();
    badge = null;
  }

  async function start(videoId) {
    const mySession = session;
    showBadge('Dual Subtitles: loading German subtitles…');
    const result = await DS.loadGermanCaptions(videoId);
    if (mySession !== session) return;

    if (result.error === 'noGerman') {
      showBadge('Dual Subtitles: this video has no German subtitles.');
      return;
    }
    if (result.error) {
      showBadge('Dual Subtitles: could not load the German subtitles. Try reloading the page.');
      return;
    }
    const kind = result.track.kind === 'asr' ? 'auto-generated' : 'manual';
    showBadge(`Dual Subtitles: ${result.lines.length} German lines loaded (${kind})`);
    console.log(`[Dual Subtitles] ${result.lines.length} German lines (${kind}):`);
    console.table(result.lines);
  }

  let lastVideoId = null;
  function onPageChange() {
    const videoId = currentVideoId();
    if (videoId === lastVideoId) return;
    lastVideoId = videoId;
    session++;
    removeBadge();
    if (videoId) start(videoId);
  }

  // YouTube is a single-page app: listen for its own navigation event.
  document.addEventListener('yt-navigate-finish', onPageChange);
  onPageChange();
})();

// Dual Subtitles – content script (runs on youtube.com).
// Ties the pieces together: detects the current video, loads its German
// captions and shows status messages.

(() => {
  'use strict';

  const DS = self.DualSubs;
  let badge = null;
  let badgeTimer = null;
  let overlay = null;
  let session = 0; // bumps on every navigation so stale async work is ignored

  function currentVideoId() {
    if (location.pathname !== '/watch') return null;
    return new URLSearchParams(location.search).get('v');
  }

  const getPlayer = () => document.getElementById('movie_player');

  // Small status label in the top-left corner of the player.
  function showBadge(text, { fade = false } = {}) {
    const player = getPlayer();
    if (!player) return;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ds-badge';
    }
    badge.textContent = text;
    badge.classList.remove('ds-faded');
    if (badge.parentElement !== player) player.appendChild(badge);
    clearTimeout(badgeTimer);
    if (fade) badgeTimer = setTimeout(() => badge?.classList.add('ds-faded'), 4000);
  }

  function removeBadge() {
    clearTimeout(badgeTimer);
    badge?.remove();
    badge = null;
  }

  function stop() {
    session++;
    overlay?.destroy();
    overlay = null;
    removeBadge();
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
    showBadge(`Dual Subtitles: ${result.lines.length} German lines loaded (${kind})`, { fade: true });
    console.log(`[Dual Subtitles] ${result.lines.length} German lines (${kind}):`);
    console.table(result.lines);
    overlay = new DS.Overlay(getPlayer(), result.lines);
  }

  let lastVideoId = null;
  function onPageChange() {
    const videoId = currentVideoId();
    if (videoId === lastVideoId) return;
    lastVideoId = videoId;
    stop();
    if (videoId) start(videoId);
  }

  // YouTube is a single-page app: listen for its own navigation event.
  document.addEventListener('yt-navigate-finish', onPageChange);
  onPageChange();
})();

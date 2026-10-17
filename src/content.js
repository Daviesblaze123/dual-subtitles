// Dual Subtitles – content script (runs on youtube.com).

(() => {
  'use strict';

  let badge = null;

  function isWatchPage() {
    return location.pathname === '/watch' && new URLSearchParams(location.search).has('v');
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

  function onPageChange() {
    if (isWatchPage()) showBadge('Dual Subtitles: extension active');
    else removeBadge();
  }

  // YouTube is a single-page app: listen for its own navigation event.
  document.addEventListener('yt-navigate-finish', onPageChange);
  onPageChange();
})();

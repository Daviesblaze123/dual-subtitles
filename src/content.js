// Dual Subtitles – content script (runs on youtube.com).
// Ties the pieces together: detects the current video, loads its German
// captions and shows status messages.

(() => {
  'use strict';

  const DS = self.DualSubs;
  let badge = null;
  let badgeTimer = null;
  let overlay = null;
  let videoTitle = '';
  let savedKeys = new Set(); // DS.vocab keys of everything saved so far
  let lastVideoId = null;
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

  // --- English line --------------------------------------------------------

  const TRANSLATOR_MESSAGES = {
    unsupported: 'English translation needs desktop Chrome 138 or newer – this browser has no built-in translator.',
    unavailable: 'Chrome cannot translate German → English on this device.',
    error: 'The translator could not start. Reload the page to try again.',
  };

  function englishFor(line) {
    const { status, progress, stalled } = DS.translator.state;
    if (status === 'ready') {
      const english = DS.translator.cached(line.text);
      if (english === null) return '(translation failed)';
      return english ?? '…';
    }
    if (status === 'needsDownload') {
      const button = document.createElement('button');
      button.className = 'ds-download';
      button.textContent = 'Click to enable English translation (one-time download)';
      button.addEventListener('click', () => DS.translator.download());
      return button;
    }
    if (status === 'downloading') {
      if (stalled) return 'The translation download has not started yet. Check your internet connection, or see the README.';
      return `Downloading the translation model… ${Math.round(progress * 100)}%`;
    }
    if (status === 'checking') return '…';
    const note = document.createElement('span');
    note.className = 'ds-note';
    note.textContent = TRANSLATOR_MESSAGES[status];
    return note;
  }

  // Translate lines ahead of time, starting from the current position, so the
  // English is ready before each line is spoken.
  async function translateAhead(lines, mySession) {
    const pending = new Set(lines.map((line) => line.text));
    while (mySession === session && overlay && pending.size) {
      if (DS.translator.state.status !== 'ready') return;
      const from = overlay.upcomingIndex;
      const next = lines.slice(from).find((l) => pending.has(l.text)) || lines.find((l) => pending.has(l.text));
      pending.delete(next.text);
      await DS.translator.translate(next.text);
      if (mySession === session && overlay?.currentLine?.text === next.text) overlay.render();
    }
  }

  DS.translator.onChange((state) => {
    if (!overlay) return;
    overlay.render();
    if (state.status === 'ready') translateAhead(overlay.lines, session);
    if (TRANSLATOR_MESSAGES[state.status]) showBadge(`Dual Subtitles: ${TRANSLATOR_MESSAGES[state.status]}`, { fade: true });
  });

  // --- Word popup -----------------------------------------------------------

  async function onWordClick(word, element) {
    overlay.video?.pause(); // give the learner time to read
    const line = overlay.currentLine;
    const ready = DS.translator.state.status === 'ready';

    const german = document.createElement('div');
    german.className = 'ds-popup-de';
    german.textContent = word;
    const english = document.createElement('div');
    english.className = 'ds-popup-en';
    if (ready) english.textContent = DS.translator.cached(word) ?? '…';
    else english.textContent = TRANSLATOR_MESSAGES[DS.translator.state.status] || 'Enable the translation first (button under the subtitle).';

    const save = document.createElement('button');
    save.className = 'ds-popup-save';
    const showSaved = () => {
      const saved = savedKeys.has(DS.vocab.keyOf('word', word));
      save.textContent = saved ? '★ Saved' : '☆ Save word';
      save.disabled = saved;
    };
    showSaved();
    save.addEventListener('click', async () => {
      const translation = ready ? await DS.translator.translate(word) : null;
      await saveItem({ type: 'word', german: word, english: translation || '', context: line?.text || '', time: line?.start });
      showSaved();
    });

    const content = document.createElement('div');
    content.append(german, english, save);
    overlay.showPopup(element, content);

    if (ready) {
      const result = await DS.translator.translate(word);
      english.textContent = result ?? '(translation failed)';
      overlay?.positionPopup();
    }
  }

  // --- Saving ----------------------------------------------------------------

  async function saveItem(item) {
    const added = await DS.vocab.add({ ...item, videoId: lastVideoId, videoTitle, time: Math.floor(item.time || 0) });
    savedKeys.add(DS.vocab.keyOf(item.type, item.german));
    overlay?.render();
    showBadge(added ? `Saved: ${item.german}` : `Already in your vocab list: ${item.german}`, { fade: true });
  }

  async function saveSentence() {
    const line = overlay?.lastLine;
    if (!line) return showBadge('Dual Subtitles: no subtitle to save yet.', { fade: true });
    let english = DS.translator.cached(line.text);
    if (english === undefined && DS.translator.state.status === 'ready') english = await DS.translator.translate(line.text);
    await saveItem({ type: 'sentence', german: line.text, english: english || '', time: line.start });
  }

  function isSaved(line) {
    return savedKeys.has(DS.vocab.keyOf('sentence', line.text));
  }

  function updateSavedKeys(items) {
    savedKeys = new Set(items.map((it) => DS.vocab.keyOf(it.type, it.german)));
    overlay?.render();
  }

  DS.vocab.list().then(updateSavedKeys);
  DS.vocab.onChange(updateSavedKeys);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'saveSentence') saveSentence();
  });

  // --- Lifecycle -------------------------------------------------------------

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
    overlay.getEnglish = englishFor;
    overlay.onWordClick = onWordClick;
    overlay.onSave = saveSentence;
    overlay.isSaved = isSaved;
    videoTitle = result.title;
    overlay.render();
    if (DS.translator.state.status === 'ready') translateAhead(result.lines, mySession);
    else DS.translator.init();
  }

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

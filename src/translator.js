// Dual Subtitles – translation.
// Wraps Chrome's built-in, on-device Translator API (German → English) and
// remembers every result so each text is only translated once.

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});
  const LANGS = { sourceLanguage: 'de', targetLanguage: 'en' };

  let translator = null;
  const cache = new Map(); // German text → Promise<string | null>
  const listeners = new Set();

  const state = {
    // checking | unsupported | unavailable | needsDownload | downloading | ready | error
    status: 'checking',
    progress: 0, // download progress, 0–1
    stalled: false, // true if the download has not moved for a while
  };

  function setState(changes) {
    Object.assign(state, changes);
    listeners.forEach((fn) => fn(state));
  }

  async function create() {
    setState({ status: 'downloading', progress: 0, stalled: false });
    const stallTimer = setTimeout(() => state.progress === 0 && setState({ stalled: true }), 30000);
    try {
      translator = await self.Translator.create({
        ...LANGS,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => setState({ progress: e.loaded, stalled: false }));
        },
      });
    } finally {
      clearTimeout(stallTimer);
    }
    setState({ status: 'ready', stalled: false });
  }

  DS.translator = {
    state,

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Check what this browser supports. Starts the translator right away if
    // the language model is already on the device.
    async init() {
      if (translator || state.status === 'downloading') return;
      if (typeof self.Translator?.availability !== 'function') return setState({ status: 'unsupported' });
      try {
        const availability = await self.Translator.availability(LANGS);
        if (availability === 'unavailable') return setState({ status: 'unavailable' });
        if (availability === 'available') return await create();
        setState({ status: 'needsDownload' });
      } catch (err) {
        console.warn('[Dual Subtitles] Translator check failed', err);
        setState({ status: 'error' });
      }
    },

    // Downloading the language model needs a click from the user, so this must
    // be called from a click handler.
    async download() {
      try {
        await create();
      } catch (err) {
        console.warn('[Dual Subtitles] Translator download failed', err);
        setState({ status: 'error' });
      }
    },

    // Already-finished translation, or undefined.
    cached(text) {
      return cache.get(text)?.result;
    },

    // Resolves to the English text, or null if translation failed.
    translate(text) {
      if (!translator) return Promise.resolve(null);
      if (!cache.has(text)) {
        const entry = translator.translate(text).then(
          (result) => (entry.result = result),
          (err) => {
            console.warn('[Dual Subtitles] Translation failed', err);
            return (entry.result = null);
          },
        );
        cache.set(text, entry);
      }
      return cache.get(text);
    },
  };
})();

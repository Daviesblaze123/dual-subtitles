// Dual Subtitles – display settings (font size, position, English on/off).
// Stored in chrome.storage.local. Used by the content script and the popup.

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});
  const KEY = 'settings';

  const DEFAULTS = {
    fontSize: 'M', // S | M | L | XL
    position: 'bottom', // bottom | higher | top
    showEnglish: true,
  };

  DS.settings = {
    DEFAULTS,

    async load() {
      const data = await chrome.storage.local.get(KEY);
      return { ...DEFAULTS, ...data[KEY] };
    },

    async save(changes) {
      const current = await this.load();
      await chrome.storage.local.set({ [KEY]: { ...current, ...changes } });
    },

    // Calls fn(settings) whenever the settings change.
    onChange(fn) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) fn({ ...DEFAULTS, ...changes[KEY].newValue });
      });
    },
  };
})();

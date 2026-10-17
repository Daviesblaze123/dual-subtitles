// Dual Subtitles – vocabulary list.
// Stored in chrome.storage.local, so it stays on this computer and survives
// page reloads and browser restarts. Used by the content script and the popup.

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});
  const KEY = 'vocab';

  // Two items count as the same if they have the same type and German text.
  const keyOf = (type, german) => `${type}:${german.trim().toLowerCase()}`;

  async function load() {
    const data = await chrome.storage.local.get(KEY);
    return data[KEY] || [];
  }

  DS.vocab = {
    keyOf,

    // All items, newest first.
    list: load,

    // item: { type: 'word' | 'sentence', german, english, context?, videoId?, videoTitle?, time? }
    // Resolves to true if added, false if it was already in the list.
    async add(item) {
      const items = await load();
      const key = keyOf(item.type, item.german);
      if (items.some((it) => keyOf(it.type, it.german) === key)) return false;
      items.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt: new Date().toISOString(),
        ...item,
        german: item.german.trim(),
      });
      await chrome.storage.local.set({ [KEY]: items });
      return true;
    },

    async remove(id) {
      const items = await load();
      await chrome.storage.local.set({ [KEY]: items.filter((it) => it.id !== id) });
    },

    // Calls fn(items) whenever the list changes (in any tab or the popup).
    onChange(fn) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) fn(changes[KEY].newValue || []);
      });
    },
  };
})();

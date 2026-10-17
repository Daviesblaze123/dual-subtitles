// Dual Subtitles – extension popup: on/off toggle and the vocab list.

(() => {
  'use strict';

  const DS = self.DualSubs;
  const $ = (id) => document.getElementById(id);

  // --- On/off toggle ----------------------------------------------------------

  async function initToggle() {
    const { enabled } = await chrome.storage.local.get('enabled');
    $('enabled').checked = enabled !== false;
    showStatus();
    $('enabled').addEventListener('change', async () => {
      await chrome.storage.local.set({ enabled: $('enabled').checked });
      showStatus();
    });
  }

  function showStatus() {
    $('status').textContent = $('enabled').checked
      ? 'On – German + English subtitles show on YouTube videos with German subtitles.'
      : 'Off – YouTube looks and works as normal.';
  }

  // --- Vocab list ------------------------------------------------------------

  function videoLink(item) {
    if (!item.videoId) return null;
    const a = document.createElement('a');
    a.href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}&t=${item.time || 0}s`;
    a.target = '_blank';
    a.textContent = item.videoTitle || 'YouTube video';
    return a;
  }

  function renderItem(item) {
    const li = document.createElement('li');

    const german = document.createElement('div');
    german.className = 'de';
    german.textContent = item.german;

    const english = document.createElement('div');
    english.className = 'en';
    english.textContent = item.english || '(no translation)';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const type = document.createElement('span');
    type.className = `tag ${item.type}`;
    type.textContent = item.type;
    meta.append(type);
    const link = videoLink(item);
    if (link) meta.append(' ', link);

    const remove = document.createElement('button');
    remove.className = 'delete';
    remove.title = 'Delete';
    remove.textContent = '×';
    remove.addEventListener('click', () => DS.vocab.remove(item.id));

    li.append(german, english);
    if (item.type === 'word' && item.context) {
      const context = document.createElement('div');
      context.className = 'context';
      context.textContent = item.context;
      li.append(context);
    }
    li.append(meta, remove);
    return li;
  }

  function renderList(items) {
    $('count').textContent = items.length ? `(${items.length})` : '';
    $('empty').hidden = items.length > 0;
    $('list').replaceChildren(...items.map(renderItem));
  }

  initToggle();
  DS.vocab.list().then(renderList);
  DS.vocab.onChange(renderList);
})();

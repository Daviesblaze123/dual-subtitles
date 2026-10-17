// Dual Subtitles – CSV export of the vocab list.
// UTF-8 with a byte-order mark so Excel shows ä, ö, ü and ß correctly.
// German and English are the first two columns, which Anki uses as front and back.

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});

  const COLUMNS = ['German', 'English', 'Type', 'Context', 'Video', 'Link', 'Saved at'];

  function cell(value) {
    let text = String(value ?? '');
    // Excel would treat text starting with = + - @ as a formula (e.g. "- Ja, klar.").
    if (/^[=+\-@]/.test(text)) text = ` ${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function link(item) {
    return item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}&t=${item.time || 0}s` : '';
  }

  function date(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  DS.toCsv = function (items) {
    const rows = items.map((it) => [it.german, it.english, it.type, it.context, it.videoTitle, link(it), date(it.savedAt)]);
    return '﻿' + [COLUMNS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  };
})();

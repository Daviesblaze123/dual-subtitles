// Dual Subtitles – caption loader.
// Finds the German caption track of the current video and turns it into a list
// of lines: [{ start, end, text }] with times in seconds.

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});
  const SOURCE = 'dual-subtitles';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Messaging with the page script (src/inject.js) -----------------------

  const captured = []; // caption files the player downloaded: { url, text }
  const listeners = new Set();

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (event.source !== window || msg?.source !== SOURCE || msg.from !== 'page') return;
    if (msg.type === 'captionData') {
      captured.push({ url: msg.url, text: msg.text });
      if (captured.length > 20) captured.shift();
    }
    listeners.forEach((fn) => fn(msg));
  });

  function toPage(msg) {
    window.postMessage({ source: SOURCE, from: 'content', ...msg }, location.origin);
  }

  // Wait for a message from the page that satisfies `test`.
  function waitFor(test, timeoutMs) {
    return new Promise((resolve) => {
      const done = (value) => {
        listeners.delete(fn);
        clearTimeout(timer);
        resolve(value);
      };
      const fn = (msg) => test(msg) && done(msg);
      const timer = setTimeout(() => done(null), timeoutMs);
      listeners.add(fn);
    });
  }

  async function getTracks(videoId) {
    // Right after navigating, the player may still report the previous video.
    for (let i = 0; i < 20; i++) {
      const requestId = Math.random().toString(36).slice(2);
      const reply = waitFor((m) => m.type === 'tracks' && m.requestId === requestId, 1000);
      toPage({ type: 'getTracks', requestId });
      const info = await reply;
      if (info?.videoId === videoId) return info;
      await sleep(500);
    }
    return null;
  }

  // --- Choosing and downloading the German track ----------------------------

  const isGerman = (code) => code === 'de' || code?.startsWith('de-');

  function pickGermanTrack(tracks) {
    const german = tracks.filter((t) => isGerman(t.languageCode));
    // Prefer subtitles written by people over auto-generated ones.
    return german.find((t) => t.kind !== 'asr') || german[0] || null;
  }

  function isFileFor(url, videoId, track) {
    const p = new URL(url).searchParams;
    return p.get('v') === videoId && p.get('lang') === track.languageCode &&
      (p.get('kind') || '') === track.kind && !p.get('tlang');
  }

  async function fetchDirect(track) {
    try {
      const url = new URL(track.baseUrl, location.href);
      url.searchParams.set('fmt', 'json3');
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.text() : '';
    } catch {
      return '';
    }
  }

  async function downloadTrack(videoId, track) {
    const already = captured.findLast((c) => isFileFor(c.url, videoId, track));
    if (already) return already.text;

    const direct = await fetchDirect(track);
    if (direct.trim()) return direct;

    const reply = waitFor((m) => m.type === 'captionData' && isFileFor(m.url, videoId, track), 15000);
    toPage({ type: 'enableTrack', track: { languageCode: track.languageCode, kind: track.kind } });
    return (await reply)?.text || '';
  }

  // --- Parsing ---------------------------------------------------------------

  const clean = (text) => text.replace(/\s+/g, ' ').trim();

  function parseJson3(data) {
    const cues = [];
    for (const ev of data.events || []) {
      if (!ev.segs) continue;
      const text = clean(ev.segs.map((s) => s.utf8 || '').join(''));
      if (!text) continue;
      const start = ev.tStartMs / 1000;
      cues.push({ start, end: start + (ev.dDurationMs || 0) / 1000, text });
    }
    return cues;
  }

  function decodeEntities(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function attr(attrs, name) {
    return attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  }

  // Older XML formats: <p t="ms" d="ms"> (srv3) or <text start="s" dur="s"> (srv1).
  function parseXml(xml) {
    const cues = [];
    for (const [, attrs, body] of xml.matchAll(/<(?:p|text)\b([^>]*)>([\s\S]*?)<\/(?:p|text)>/g)) {
      const text = clean(decodeEntities(body));
      if (!text) continue;
      const ms = attr(attrs, 't');
      const start = ms != null ? Number(ms) / 1000 : Number(attr(attrs, 'start'));
      const dur = ms != null ? Number(attr(attrs, 'd') || 0) / 1000 : Number(attr(attrs, 'dur') || 0);
      cues.push({ start, end: start + dur, text });
    }
    return cues;
  }

  // Auto-generated captions arrive in short, overlapping fragments of a few
  // words. Join them into readable lines that are worth translating.
  function mergeFragments(cues) {
    const lines = [];
    let line = null;
    for (const cue of cues) {
      const gap = line ? cue.start - line.lastStart : 0;
      if (line && gap > 3) {
        lines.push(line);
        line = null;
      }
      if (!line) line = { start: cue.start, end: cue.end, text: cue.text, lastStart: cue.start };
      else Object.assign(line, { end: cue.end, text: `${line.text} ${cue.text}`, lastStart: cue.start });
      if (line.text.split(' ').length >= 8 || /[.?!]$/.test(line.text)) {
        lines.push(line);
        line = null;
      }
    }
    if (line) lines.push(line);
    return lines.map(({ start, end, text }) => ({ start, end, text }));
  }

  // Sort, and make sure lines never overlap so only one shows at a time.
  function tidy(cues) {
    cues.sort((a, b) => a.start - b.start);
    return cues.map((cue, i) => {
      const next = cues[i + 1];
      let end = next ? Math.min(cue.end, next.start) : cue.end;
      if (!(end > cue.start)) end = next ? next.start : cue.start + 3;
      return { start: cue.start, end, text: cue.text };
    });
  }

  function parseCaptions(text, isAuto) {
    let cues;
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) cues = parseJson3(JSON.parse(trimmed));
    else cues = parseXml(trimmed);
    cues = tidy(cues);
    return isAuto ? tidy(mergeFragments(cues)) : cues;
  }

  // --- Public API ------------------------------------------------------------

  // Resolves to { lines, track, title } or { error: 'noGerman' | 'loadFailed' }.
  DS.loadGermanCaptions = async function (videoId) {
    const info = await getTracks(videoId);
    if (!info) return { error: 'loadFailed' };
    const track = pickGermanTrack(info.tracks);
    if (!track) return { error: 'noGerman' };
    const text = await downloadTrack(videoId, track);
    if (!text.trim()) return { error: 'loadFailed' };
    try {
      const lines = parseCaptions(text, track.kind === 'asr');
      return lines.length ? { lines, track, title: info.title } : { error: 'loadFailed' };
    } catch (err) {
      console.warn('[Dual Subtitles] Could not read caption file', err);
      return { error: 'loadFailed' };
    }
  };
})();

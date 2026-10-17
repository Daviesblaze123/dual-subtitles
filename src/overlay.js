// Dual Subtitles – subtitle overlay.
// Draws the current line on top of the YouTube player and keeps it in sync
// with the video (pause, seek and fullscreen included).

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});

  // Words (letters and digits, including inner hyphens/apostrophes) become
  // clickable spans; spaces and punctuation stay plain text.
  const WORD = /([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)/u;

  function wordNodes(text) {
    return text.split(WORD).map((part, i) => {
      if (i % 2 === 0) return document.createTextNode(part);
      const span = document.createElement('span');
      span.className = 'ds-word';
      span.textContent = part;
      return span;
    });
  }

  DS.Overlay = class {
    constructor(player, lines) {
      this.player = player;
      this.lines = lines;
      this.index = -2; // index of the line on screen, -1 = none

      this.root = document.createElement('div');
      this.root.className = 'ds-overlay';
      this.box = document.createElement('div');
      this.box.className = 'ds-box';
      this.de = document.createElement('div');
      this.de.className = 'ds-de';
      this.en = document.createElement('div');
      this.en.className = 'ds-en';
      this.box.append(this.de, this.en);

      // Set by the content script: returns the English for a line, as text or
      // as a DOM node (for status messages and buttons).
      this.getEnglish = () => '';
      // Set by the content script: called with (word, element) on a word click.
      this.onWordClick = () => {};
      this.popup = null;

      this.box.addEventListener('click', (e) => {
        const word = e.target.closest('.ds-word');
        if (word) this.onWordClick(word.textContent, word);
      });

      // Close the word popup on a click anywhere else, or on Escape.
      this.onOutsideClick = (e) => {
        if (this.popup && !this.popup.contains(e.target) && !e.target.closest?.('.ds-word')) this.closePopup();
      };
      this.onKey = (e) => e.key === 'Escape' && this.closePopup();
      document.addEventListener('pointerdown', this.onOutsideClick, true);
      document.addEventListener('keydown', this.onKey, true);
      this.root.append(this.box);
      player.append(this.root);

      // Keep clicks on the subtitles from reaching the player (play/pause,
      // double-click fullscreen).
      this.stopClicks(this.box);

      // Hide YouTube's own captions while ours are shown.
      document.documentElement.classList.add('ds-active');

      this.tick = this.tick.bind(this);
      this.frame = requestAnimationFrame(this.tick);
    }

    stopClicks(element) {
      for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
        element.addEventListener(type, (e) => e.stopPropagation());
      }
    }

    get video() {
      if (!this._video?.isConnected) this._video = this.player.querySelector('video');
      return this._video;
    }

    // Index of the line that should be visible at time t, or -1.
    findLine(t) {
      let lo = 0;
      let hi = this.lines.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (this.lines[mid].start <= t) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return found >= 0 && t < this.lines[found].end ? found : -1;
    }

    tick() {
      this.frame = requestAnimationFrame(this.tick);
      const video = this.video;
      if (!video) return;
      const index = this.findLine(video.currentTime);
      if (index !== this.index) {
        this.index = index;
        this.render();
      }
    }

    get currentLine() {
      return this.lines[this.index] || null;
    }

    // Index of the line on screen, or else the next one to come.
    get upcomingIndex() {
      const t = this.video?.currentTime || 0;
      const i = this.lines.findIndex((line) => line.end > t);
      return i === -1 ? this.lines.length : i;
    }

    render() {
      const line = this.currentLine;
      if (this.renderedLine !== line) {
        this.renderedLine = line;
        this.de.replaceChildren(...(line ? wordNodes(line.text) : []));
        if (this.popup) this.closePopup();
      }
      this.box.hidden = !line;
      const english = line ? this.getEnglish(line) : '';
      if (english instanceof Node) this.en.replaceChildren(english);
      else this.en.textContent = english;
    }

    // Show `content` in a small popup above the word element `anchor`.
    showPopup(anchor, content) {
      this.closePopup();
      this.popup = document.createElement('div');
      this.popup.className = 'ds-popup';
      this.popup.append(content);
      this.stopClicks(this.popup);
      this.popupAnchor = anchor;
      this.root.append(this.popup);
      this.positionPopup();
    }

    positionPopup() {
      if (!this.popup) return;
      const root = this.root.getBoundingClientRect();
      const word = this.popupAnchor.getBoundingClientRect();
      const width = this.popup.offsetWidth;
      const center = word.left + word.width / 2 - root.left;
      const left = Math.min(Math.max(center - width / 2, 8), root.width - width - 8);
      this.popup.style.left = `${left}px`;
      this.popup.style.bottom = `${root.bottom - word.top + 10}px`;
    }

    closePopup() {
      this.popup?.remove();
      this.popup = null;
      this.popupAnchor = null;
    }

    destroy() {
      cancelAnimationFrame(this.frame);
      this.closePopup();
      document.removeEventListener('pointerdown', this.onOutsideClick, true);
      document.removeEventListener('keydown', this.onKey, true);
      this.root.remove();
      document.documentElement.classList.remove('ds-active');
    }
  };
})();

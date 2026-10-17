// Dual Subtitles – subtitle overlay.
// Draws the current line on top of the YouTube player and keeps it in sync
// with the video (pause, seek and fullscreen included).

(() => {
  'use strict';

  const DS = (self.DualSubs = self.DualSubs || {});

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
      this.box.append(this.de);
      this.root.append(this.box);
      player.append(this.root);

      // Hide YouTube's own captions while ours are shown.
      document.documentElement.classList.add('ds-active');

      this.tick = this.tick.bind(this);
      this.frame = requestAnimationFrame(this.tick);
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

    render() {
      const line = this.currentLine;
      this.box.hidden = !line;
      this.de.textContent = line ? line.text : '';
    }

    destroy() {
      cancelAnimationFrame(this.frame);
      this.root.remove();
      document.documentElement.classList.remove('ds-active');
    }
  };
})();

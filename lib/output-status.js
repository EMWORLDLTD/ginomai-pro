'use strict';
const { randomUUID } = require('node:crypto');

module.exports = function createOutputStatus() {
  const displays = new Map();
  return {
    connect(target, res) {
      if (!['sanctuary', 'livestream', 'dynamic'].includes(target)) return;
      const id = randomUUID();
      displays.set(id, { target, seen: Date.now(), revision: null });
      res.write(`event: output-session\ndata: ${JSON.stringify({ id })}\n\n`);
      return id;
    },
    disconnect(id) { displays.delete(id); },
    acknowledge(id, revision) {
      const display = displays.get(id);
      if (!display) return false;
      display.seen = Date.now();
      display.revision = revision;
      return true;
    },
    snapshot(revision, now = Date.now()) {
      return ['sanctuary', 'livestream', 'dynamic'].map(target => {
        const active = [...displays.values()].filter(display => display.target === target && now - display.seen < 10000);
        return { target, connected: active.length, received: active.length > 0 && active.every(display => display.revision === revision) };
      });
    }
  };
};

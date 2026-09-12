'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');

test('release metadata stays aligned across package, UI, server, and Electron', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const electronSource = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

  assert.equal(pkg.version, '2.4.0');
  assert.equal(pkg.build.productName, 'Ginomia Pro');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.match(index, /Ginomia Pro/);
  assert.match(index, /Build 2\.4\.0/);
  assert.doesNotMatch(index, /2\.4\.0-PRO|Ginomai Pro/);
  assert.match(serverSource, /version: packageMetadata\.version/);
  assert.match(electronSource, /app\.getVersion\(\)/);
});

test('remote control requires pairing, enforces permissions without a client flag, and respects host Hold', async t => {
  const { server } = require('../server');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, body, cookie, headers = {}) => fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  assert.equal((await request('/api/control', { type: 'PROJECT', text: 'Unauthorized' })).status, 403);
  assert.equal((await request('/api/session/start', {})).status, 403);
  assert.equal((await request('/server.js')).status, 403);
  assert.equal((await request('/.git/config')).status, 403);
  const page = await request('/');
  const host = page.headers.get('set-cookie').split(';')[0];
  assert.match(host, /^sf_access=/);
  assert.equal((await request('/api/session/start', {}, host, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request('/api/session/start', {}, host)).status, 200);
  assert.equal((await request('/api/session/join', null)).status, 400);
  const session = await (await request('/api/session', undefined, host)).json();
  assert.match(session.pairingCode, /^\d{6}$/);
  assert.equal((await (await request('/api/session')).json()).pairingCode, undefined);
  assert.equal((await request('/api/session/join', { name: 'Test', pairingCode: 'bad' })).status, 403);
  const join = await request('/api/session/join', { name: 'Test operator', pairingCode: session.pairingCode });
  assert.equal(join.status, 200);
  const operator = join.headers.get('set-cookie').split(';')[0];
  const joined = await join.json();
  assert.ok(joined.operatorId);
  assert.equal((await request('/api/session/stop', {}, operator)).status, 403);
  assert.equal((await request('/api/sync', { text: 'Bypass' }, operator)).status, 403);
  assert.equal((await request('/api/hold', { held: true }, host)).status, 200);
  assert.equal((await request('/api/control', { type: 'PROJECT', text: 'Held' }, operator)).status, 409);
  await request('/api/hold', { held: false }, host);
  await request('/api/session/privileges', { privileges: { projectSlide: false } }, host);
  assert.equal((await request('/api/control', { type: 'PROJECT', text: 'Denied' }, operator)).status, 403);
  await request('/api/session/privileges', { privileges: { projectSlide: true } }, host);
  assert.equal((await request('/api/control', { type: 'PROJECT', text: 'Allowed', slideId: 'bible_test' }, operator)).status, 202);
  assert.equal((await (await request('/api/state')).json()).text, 'Allowed');
  await request('/api/sync', { text: 'Public text', dashboard: { private: true }, hostSpeechState: { transcript: 'Private' } }, host);
  const projected = await (await request('/api/state')).json();
  assert.equal(projected.dashboard, undefined);
  assert.equal(projected.hostSpeechState, undefined);
  assert.equal(projected.text, 'Public text');
  assert.equal((await request('/api/output-ack', { id: 'unregistered', revision: 1 })).status, 403);
  const streams = await Promise.all(['/api/events', '/api/control-events'].map(async route => {
    const response = await fetch(base + route, { headers: { Cookie: operator }, signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    await reader.read();
    return reader;
  }));
  await request('/api/session/stop', {}, host);
  for (const reader of streams) {
    while (!(await reader.read()).done) { /* Drain queued events before the closed stream. */ }
  }
  assert.equal((await request('/api/control', { type: 'CLEAR' }, operator)).status, 403);
});

test('workspace patches cannot smuggle projection, deletion, or host settings', () => {
  const { filterPatch } = require('../lib/access-control');
  const patch = { activeLiveText: 'Bypass', projectorActive: false, maxLinesPerSlide: 8, agendaItems: [], textSize: 1.5 };
  assert.deepEqual(filterPatch(patch, { adjustFontSize: true }), { textSize: 1.5 });
  assert.deepEqual(filterPatch(patch, {}), {});
});

test('output status distinguishes connected, received, disconnected and stale displays', () => {
  const outputs = require('../lib/output-status')();
  const id = outputs.connect('sanctuary', { write() {} });
  assert.equal(outputs.snapshot(4)[0].connected, 1);
  assert.equal(outputs.snapshot(4)[0].received, false);
  assert.equal(outputs.acknowledge(id, 4), true);
  assert.equal(outputs.snapshot(4)[0].received, true);
  assert.equal(outputs.snapshot(5)[0].received, false);
  assert.equal(outputs.snapshot(4, Date.now() + 11000)[0].connected, 0);
  outputs.disconnect(id);
  assert.equal(outputs.acknowledge(id, 4), false);
});

function sessionHarness() {
  let fail = false;
  const values = new Map(), toasts = [];
  const window = { state: { agendaItems: [{ id: 'test', title: 'A service item' }] }, showToast: (...args) => toasts.push(args) };
  const context = vm.createContext({ window, document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => { if (fail) throw new Error('Quota exceeded'); values.set(key, value); } },
    console: { error() {} }, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/session-manager.js'), 'utf8'), context);
  const manager = window.sessionManager;
  manager.ensureActiveSession();
  return { manager, window, toasts, values, fail: value => { fail = value; } };
}

test('failed saves preserve unsaved state and do not claim success; retry persists changes', () => {
  const h = sessionHarness();
  h.fail(true);
  const before = h.values.get('sf_saved_sessions');
  h.window.state.agendaItems.push({ id: 'new', title: 'Unsaved item' });
  assert.equal(h.manager.saveCurrentSessionSnapshot(), null);
  assert.equal(h.manager.isDirty, true);
  assert.ok(h.manager.saveError);
  assert.equal(h.toasts.length, 0);
  assert.equal(h.values.get('sf_saved_sessions'), before);
  h.fail(false);
  assert.ok(h.manager.saveCurrentSessionSnapshot());
  assert.equal(h.manager.isDirty, false);
  assert.equal(h.manager.saveError, null);
  assert.equal(JSON.parse(h.values.get('sf_saved_sessions'))[0].agendaItems.length, 2);
  assert.equal(h.toasts.length, 1);
});

test('saving a snapshot does not schedule another autosave or broadcast a slide', () => {
  const h = sessionHarness();
  h.window.syncDashboardWorkspace = () => assert.fail('Save must not re-enter workspace autosave');
  assert.ok(h.manager.saveCurrentSessionSnapshot());
  assert.equal(h.manager.autoSaveTimer, null);
});

test('a failed save blocks switching and deleting the current session without losing the workspace', () => {
  const h = sessionHarness();
  const activeId = h.manager.activeSessionId;
  const other = h.manager.createSessionObject('Other service');
  h.manager.sessions.push(other);
  h.fail(true);
  assert.equal(h.manager.loadSession(other.id), false);
  assert.equal(h.manager.activeSessionId, activeId);
  assert.equal(h.manager.deleteSession(activeId), false);
  assert.equal(h.manager.activeSessionId, activeId);
  assert.equal(h.manager.sessions.length, 2);
  assert.equal(h.window.state.agendaItems[0].title, 'A service item');
});

test('all active-page inline scripts remain syntactically valid', () => {
  for (const file of ['index.html', 'display.html', 'operator.html', 'remote.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1])) continue;
      assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }));
    }
  }
});

test('Enter on Cancel does not submit a custom confirmation', () => {
  const listeners = [];
  const backdrop = { style: { display: 'flex' }, classList: { contains: () => true } };
  const window = { addEventListener: (_type, handler) => listeners.push(handler) };
  const context = vm.createContext({ window, document: { getElementById: () => backdrop } });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/custom-dialog.js'), 'utf8'), context);
  let submits = 0;
  window.sfSubmitCustomDialog = () => submits++;
  const event = id => ({ key: 'Enter', target: { id }, preventDefault() {}, stopPropagation() {} });
  listeners[0](event('sf-dialog-cancel-btn'));
  assert.equal(submits, 0);
  listeners[0](event('sf-dialog-input'));
  assert.equal(submits, 1);
});

test('same-deck projection is immediate, preserves cards, and updates the preview once', () => {
  const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const project = source.slice(source.indexOf('function projectSlide('), source.indexOf('function sendRemoteCommand('));
  const calls = [];
  const state = { scriptureHistory: [], currentTab: 'songs' };
  const window = {};
  const context = vm.createContext({ window, state, REMOTE_MODE: false, document: { getElementById: () => null },
    updateActiveSlideVisuals: id => calls.push(['active', id]), updateLivePreview: () => calls.push(['preview']),
    syncStateFromSlideId: () => false, broadcastState: (_payload, alreadyUpdated) => calls.push(['broadcast', alreadyUpdated]),
    renderDeck: () => assert.fail('Selecting within a deck must not rebuild its cards'), renderAiHud() {},
    setTimeout: () => 1, clearTimeout() {}, showToast: () => calls.push(['held']) });
  vm.runInContext(project, context);
  context.projectSlide('song_test_0', 'First slide', 'Test song');
  assert.equal(state.activeLiveText, 'First slide');
  assert.deepEqual(calls, [['active', 'song_test_0'], ['preview'], ['broadcast', true]]);
  state.isHoldLive = true;
  context.projectSlide('song_test_1', 'Second slide', 'Test song');
  assert.equal(state.activeLiveText, 'First slide');
  state.isHoldLive = false;
  window.prepareSlideIfNeeded = () => true;
  context.projectSlide('song_test_1', 'Prepared slide', 'Test song');
  assert.equal(state.activeLiveText, 'First slide');
});

test('preview requires Take live, preserves a held selection, and can be cancelled', () => {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '' }); return elements.get(id); };
  const calls = [];
  const window = { state: { isHoldLive: false, autoProject: false }, projectSlide: (...args) => calls.push(args), showToast() {} };
  const document = { readyState: 'loading', addEventListener() {}, getElementById: element, querySelector: () => null };
  const context = vm.createContext({ window, document, localStorage: { getItem: () => 'preview', setItem() {} } });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/operator-experience.js'), 'utf8'), context);
  assert.equal(window.prepareSlideIfNeeded('song_test', 'Prepared text', 'Reference', {}), true);
  assert.equal(calls.length, 0);
  assert.equal(element('prepared-slide').hidden, false);
  window.state.isHoldLive = true;
  window.takePreparedSlide();
  assert.equal(calls.length, 0);
  assert.equal(element('prepared-slide').hidden, false);
  window.state.isHoldLive = false;
  window.takePreparedSlide();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][3].takeLive, true);
  assert.equal(element('prepared-slide').hidden, true);
  window.prepareSlideIfNeeded('other', 'Other text', 'Reference', {});
  window.cancelPreparedSlide();
  window.takePreparedSlide();
  assert.equal(calls.length, 1);
  window.setProjectionWorkflow('instant');
  assert.equal(window.prepareSlideIfNeeded('other', 'Instant', 'Reference', {}), false);
});

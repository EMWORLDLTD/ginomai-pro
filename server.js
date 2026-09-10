// Ginomai Pro - Native Broadcast & OBS Sync Server
// The Word in Motion
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8500;
const PUBLIC_DIR = __dirname;
let currentBoundPort = PORT;

// ─── Display State ────────────────────────────────────────────────────────────
let currentState = {
  mode: 'full',
  projectorActive: true,
  livestreamActive: true,
  text: '',
  reference: '',
  version: '',
  compare: false,
  textSize: 1.0,
  textAutoScale: true,
  bg: '#0F172A',
  clear: false,
  clearBg: false,
  _timestamp: Date.now()
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
let controlCatalog = { bible: {}, songs: [] };

// ─── Host Speech AI State (Mirrored to Remote Operators) ───────────────────────
let hostSpeechState = {
  isListening: false,
  transcript: '',
  detectedVerses: [],
  detectedSongs: [],
  paraphraseMatches: [],
  updatedAt: Date.now()
};

// ─── Shadow Deck State (last song operator had loaded — for crash continuity) ─
let shadowDeckState = null;

// ─── Lexicon Cache ────────────────────────────────────────────────────────────
let lexiconCache = null;

// ─── Cloud Lyrics Cache (In-Memory, 1hr TTL, max 500 entries) ─────────────────
const lyricsCache = new Map();
const LYRICS_CACHE_TTL_MS = 60 * 60 * 1000;

// ─── Remote Session ───────────────────────────────────────────────────────────
const DEFAULT_PRIVILEGES = {
  // Projection
  projectSlide: true,
  navigateSlides: true,
  clearScreen: true,
  // Library
  loadSong: true,
  importSongsDirect: false,
  importSongsRequest: true,
  importBibles: false,
  editLyrics: false,
  // Agenda
  addAgendaItems: true,
  reorderAgenda: false,
  removeAgendaItems: false,
  // Medley
  loadMedleySlots: true,
  switchMedleyMode: false,
  // Display
  adjustFontSize: false,
  toggleTransparentBg: false,
  // AI
  autoProject: false,
  // Always blocked (never in privileges object — enforced in code)
  // deleteSong: never
  // openSettings: never
  // aiMic: never
  // maxLinesPerSlide: never
};

const FULL_CONTROL_PRIVILEGES = {
  projectSlide: true,
  navigateSlides: true,
  clearScreen: true,
  loadSong: true,
  importSongsDirect: true,
  importSongsRequest: true,
  importBibles: true,
  editLyrics: true,
  addAgendaItems: true,
  reorderAgenda: true,
  removeAgendaItems: true,
  loadMedleySlots: true,
  switchMedleyMode: true,
  adjustFontSize: true,
  toggleTransparentBg: true,
  autoProject: true,
};

// Current remote session state (Dedicated Single Operator with Full Control)
let remoteSession = {
  enabled: false,
  importMode: 'direct',
  privileges: { ...FULL_CONTROL_PRIVILEGES },
  connectedOperators: [],   // [{ id, name, joinedAt }]
  savedProfiles: [],
  pendingImports: [],
};

// ─── SSE Clients ──────────────────────────────────────────────────────────────
const sseClients = new Set();       // OBS display clients
const controlClients = new Set();   // Host studio — receives operator commands
const operatorClients = new Map();  // operatorId → res  — receive privilege updates

function publishState() {
  const sseData = `data: ${JSON.stringify(currentState)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(sseData); } catch { sseClients.delete(client); }
  });
}

function broadcastToOperators(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  operatorClients.forEach((res, id) => {
    try { res.write(data); } catch { operatorClients.delete(id); }
  });
}

function broadcastPrivilegeUpdate() {
  broadcastToOperators({
    type: 'PRIVILEGE_UPDATE',
    privileges: remoteSession.privileges,
    importMode: remoteSession.importMode,
    sessionEnabled: remoteSession.enabled,
  });
}

function getLanAddresses() {
  const addresses = [];
  Object.values(os.networkInterfaces()).forEach(network => {
    (network || []).forEach(details => {
      if (details.family === 'IPv4' && !details.internal && !details.address.startsWith('169.254.')) {
        addresses.push(details.address);
      }
    });
  });
  return [...new Set(addresses)];
}

// ─── Always-Blocked Commands (regardless of privileges) ───────────────────────
const ALWAYS_BLOCKED_FROM_REMOTE = new Set([
  'DELETE_SONG', 'OPEN_SETTINGS', 'TOGGLE_AI_MIC', 'SET_MAX_LINES'
]);

// ─── Privilege → Command type mapping ─────────────────────────────────────────
function isCommandAllowed(command, privileges) {
  if (ALWAYS_BLOCKED_FROM_REMOTE.has(command.type)) return false;
  switch (command.type) {
    case 'PROJECT':      return privileges.projectSlide;
    case 'NAVIGATE':     return privileges.navigateSlides;
    case 'CLEAR':        return privileges.clearScreen;
    case 'BLACKOUT':     return privileges.clearScreen;
    case 'LOAD_SONG':    return privileges.loadSong;
    case 'IMPORT_SONG':  return privileges.importSongsDirect || privileges.importSongsRequest;
    case 'IMPORT_BIBLE': return privileges.importBibles;
    case 'EDIT_LYRICS':  return privileges.editLyrics;
    case 'AGENDA_ADD':   return privileges.addAgendaItems;
    case 'AGENDA_REORDER': return privileges.reorderAgenda;
    case 'AGENDA_REMOVE': return privileges.removeAgendaItems;
    case 'MEDLEY_LOAD':  return privileges.loadMedleySlots;
    case 'MEDLEY_MODE':  return privileges.switchMedleyMode;
    case 'SET_FONT_SIZE': return privileges.adjustFontSize;
    case 'TOGGLE_TRANSPARENT_BG': return privileges.toggleTransparentBg;
    case 'AUTO_PROJECT': return privileges.autoProject;
    case 'PUSH_TO_HOST': return true;
    case 'CATALOG_PUSHED': return true;
    case 'PUSH_TO_OPERATOR': return true;
    case 'SPEECH_AI_UPDATE': return true;
    case 'STATE_PATCH':  return true; // filtered internally
    case 'SHADOW_DECK':  return true; // always allowed — continuity
    case 'CATALOG_UPDATE': return true;
    default: return false;
  }
}

// ─── MIME Types ───────────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // ── JSON body helper ────────────────────────────────────────────────────────
  function readBody(cb) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body || !body.trim()) return cb(null, {});
      try { cb(null, JSON.parse(body)); } catch { cb(new Error('Bad JSON')); }
    });
  }

  function json(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/network — returns active LAN IP addresses and actual bound port
  if (pathname === '/api/network' && req.method === 'GET') {
    const addresses = getLanAddresses();
    json(200, {
      addresses,
      port: currentBoundPort,
      preferred: addresses[0] || 'localhost'
    });
    return;
  }

  // GET /api/session — full session info for host panel
  if (pathname === '/api/session' && req.method === 'GET') {
    const addresses = getLanAddresses();
    // Prune operators that have no active SSE connection and did not join recently
    if (operatorClients.size > 0) {
      remoteSession.connectedOperators = remoteSession.connectedOperators.filter(o => operatorClients.has(o.id) || (Date.now() - (o.joinedAt || 0) < 15000));
    } else {
      remoteSession.connectedOperators = remoteSession.connectedOperators.filter(o => (Date.now() - (o.joinedAt || 0) < 15000));
    }
    json(200, {
      enabled: remoteSession.enabled,
      importMode: remoteSession.importMode,
      privileges: remoteSession.privileges,
      connectedOperators: remoteSession.connectedOperators,
      savedProfiles: remoteSession.savedProfiles,
      pendingImports: remoteSession.pendingImports,
      hostSpeechState: hostSpeechState,
      lanUrl: addresses[0] ? `http://${addresses[0]}:${currentBoundPort}/index.html?remote=1` : null,
      port: currentBoundPort,
    });
    return;
  }

  // POST /api/session/start — host starts the session
  if (pathname === '/api/session/start' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      remoteSession.enabled = true;
      remoteSession.privileges = { ...FULL_CONTROL_PRIVILEGES };
      remoteSession.importMode = 'direct';
      // Broadcast to any already-connected operator clients
      broadcastPrivilegeUpdate();
      // Also tell host control channel
      const ev = `data: ${JSON.stringify({ type: 'REMOTE_SERVER_STATUS', enabled: true, session: remoteSession })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(200, { success: true, enabled: true });
    });
    return;
  }

  // POST /api/session/stop — host stops the session
  if (pathname === '/api/session/stop' && req.method === 'POST') {
    remoteSession.enabled = false;
    remoteSession.connectedOperators = [];
    remoteSession.pendingImports = [];
    broadcastToOperators({ type: 'SESSION_ENDED' });
    const ev = `data: ${JSON.stringify({ type: 'REMOTE_SERVER_STATUS', enabled: false })}\n\n`;
    controlClients.forEach(c => { try { c.write(ev); } catch {} });
    json(200, { success: true, enabled: false });
    return;
  }

  // POST /api/session/privileges — host updates privileges live
  if (pathname === '/api/session/privileges' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (payload.privileges && typeof payload.privileges === 'object') {
        remoteSession.privileges = { ...DEFAULT_PRIVILEGES, ...payload.privileges };
      }
      if (payload.importMode === 'direct' || payload.importMode === 'request') {
        remoteSession.importMode = payload.importMode;
      }
      broadcastPrivilegeUpdate();
      json(200, { success: true, privileges: remoteSession.privileges });
    });
    return;
  }

  // POST /api/session/profiles — save an operator profile
  if (pathname === '/api/session/profiles' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (!payload.name) return json(400, { error: 'Profile name required' });
      const existing = remoteSession.savedProfiles.findIndex(p => p.name === payload.name);
      const profile = {
        name: payload.name,
        privileges: payload.privileges || remoteSession.privileges,
        importMode: payload.importMode || remoteSession.importMode,
        savedAt: Date.now(),
      };
      if (existing >= 0) remoteSession.savedProfiles[existing] = profile;
      else remoteSession.savedProfiles.push(profile);
      json(200, { success: true, profiles: remoteSession.savedProfiles });
    });
    return;
  }

  // GET /api/session/profiles — list saved operator profiles
  if (pathname === '/api/session/profiles' && req.method === 'GET') {
    json(200, { profiles: remoteSession.savedProfiles });
    return;
  }

  // GET /api/version — returns current software release and update metadata
  if (pathname === '/api/version' && req.method === 'GET') {
    json(200, {
      appName: 'Ginomai Pro',
      tagline: 'The Word in Motion',
      version: '2.4.0-PRO',
      build: '2.4.0-PRO',
      releaseDate: '2026-09-10',
      isLatest: true,
      latestVersion: '2.4.0-PRO',
      changelogUrl: 'https://github.com/EMWORLDLTD/ginomai-pro/releases',
      features: [
        'Bento Studio Pro modular 3-zone architecture',
        '0ms tactile latency slide projection',
        'Scoped container scrolling with non-GPU hardware acceleration',
        'Integrated Deepgram Nova AI speech recognition',
        'KJV Strong\'s Greek/Hebrew Concordance'
      ]
    });
    return;
  }

  // POST /api/session/shadow-deck — operator pushes loaded song to host for crash continuity
  if (pathname === '/api/session/shadow-deck' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      shadowDeckState = { ...payload, updatedAt: Date.now() };
      // Forward silently to host as SHADOW_DECK command
      const ev = `data: ${JSON.stringify({ type: 'SHADOW_DECK', songId: payload.songId, songTitle: payload.songTitle, stanzas: payload.stanzas })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(200, { success: true });
    });
    return;
  }

  // GET /api/session/shadow-deck — host retrieves last shadow deck state
  if (pathname === '/api/session/shadow-deck' && req.method === 'GET') {
    json(200, shadowDeckState || { empty: true });
    return;
  }

  // POST /api/deepgram/verify-key — verify Deepgram API key server-side (avoids browser CORS)
  if (pathname === '/api/deepgram/verify-key' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      const apiKey = (payload && payload.apiKey) ? payload.apiKey.trim() : '';
      if (!apiKey) return json(400, { error: 'API key is required' });

      const https = require('https');
      const reqDg = https.request('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'User-Agent': 'Ginomai-Pro/1.0'
        },
        timeout: 8000
      }, (resDg) => {
        let dgBody = '';
        resDg.on('data', chunk => { dgBody += chunk; });
        resDg.on('end', () => {
          if (resDg.statusCode >= 200 && resDg.statusCode < 300) {
            json(200, { success: true, valid: true });
          } else {
            json(200, { success: false, valid: false, status: resDg.statusCode, error: 'Invalid API Key' });
          }
        });
      });

      reqDg.on('error', (netErr) => {
        json(200, { success: false, valid: false, error: netErr.message || 'Could not connect to Deepgram server' });
      });

      reqDg.on('timeout', () => {
        reqDg.destroy();
        json(200, { success: false, valid: false, error: 'Connection to Deepgram timed out' });
      });

      reqDg.end();
    });
    return;
  }

  // POST /api/session/push-to-remote — host pushes full library & agenda to all remote operators
  if (pathname === '/api/session/push-to-remote' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      controlCatalog = {
        bible: (payload && typeof payload.bible === 'object') ? payload.bible : (controlCatalog.bible || {}),
        songs: Array.isArray(payload && payload.songs) ? payload.songs : (controlCatalog.songs || []),
        agendaItems: Array.isArray(payload && payload.agendaItems) ? payload.agendaItems : (controlCatalog.agendaItems || []),
        updatedAt: Date.now()
      };
      // Broadcast to operators via operator SSE & control channel
      broadcastToOperators({ type: 'CATALOG_PUSHED', catalog: controlCatalog });
      const ev = `data: ${JSON.stringify({ type: 'CATALOG_PUSHED', catalog: controlCatalog })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(200, { success: true, count: controlCatalog.songs.length, agendaCount: controlCatalog.agendaItems.length });
    });
    return;
  }

  // POST /api/session/push-to-operator — host pushes library & agenda to a single specific operator
  if (pathname === '/api/session/push-to-operator' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      const targetOpId = payload.operatorId;
      if (!targetOpId) return json(400, { error: 'operatorId is required' });

      const catalogData = {
        bible: (payload && typeof payload.bible === 'object') ? payload.bible : (controlCatalog.bible || {}),
        songs: Array.isArray(payload && payload.songs) ? payload.songs : (controlCatalog.songs || []),
        agendaItems: Array.isArray(payload && payload.agendaItems) ? payload.agendaItems : (controlCatalog.agendaItems || []),
        updatedAt: Date.now()
      };
      // Update master controlCatalog
      controlCatalog = catalogData;

      const targetRes = operatorClients.get(targetOpId);
      if (targetRes) {
        try {
          targetRes.write(`data: ${JSON.stringify({ type: 'CATALOG_PUSHED', catalog: catalogData, targeted: true })}\n\n`);
        } catch (e) {
          operatorClients.delete(targetOpId);
        }
      }
      json(200, { success: true, count: catalogData.songs.length, agendaCount: catalogData.agendaItems.length, operatorId: targetOpId });
    });
    return;
  }

  // POST /api/session/speech-ai-update — host broadcasts live Speech AI & Mic state to operators
  if (pathname === '/api/session/speech-ai-update' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (payload.isListening !== undefined) hostSpeechState.isListening = !!payload.isListening;
      if (payload.transcript !== undefined) hostSpeechState.transcript = payload.transcript;
      if (payload.audioLevel !== undefined) hostSpeechState.audioLevel = payload.audioLevel;
      if (payload.detectedVerses && Array.isArray(payload.detectedVerses)) hostSpeechState.detectedVerses = payload.detectedVerses;
      if (payload.detectedSongs && Array.isArray(payload.detectedSongs)) hostSpeechState.detectedSongs = payload.detectedSongs;
      if (payload.paraphraseMatches && Array.isArray(payload.paraphraseMatches)) hostSpeechState.paraphraseMatches = payload.paraphraseMatches;
      hostSpeechState.updatedAt = Date.now();

      currentState = { ...currentState, hostSpeechState, _timestamp: Date.now() };

      const speechEvent = `data: ${JSON.stringify({ type: 'SPEECH_AI_UPDATE', ...payload, hostSpeechState })}\n\n`;

      // 1. Broadcast to operators
      operatorClients.forEach((res, id) => {
        try { res.write(speechEvent); } catch { operatorClients.delete(id); }
      });
      // 2. Broadcast to control channels (all remote instances)
      controlClients.forEach(res => {
        try { res.write(speechEvent); } catch { controlClients.delete(res); }
      });
      // 3. Broadcast to display & stage preview stream
      sseClients.forEach(res => {
        try { res.write(speechEvent); } catch { sseClients.delete(res); }
      });

      json(200, { success: true });
    });
    return;
  }

  // POST /api/session/push-to-host — remote operator pushes newly created/added songs & agenda items to host
  if (pathname === '/api/session/push-to-host' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (!remoteSession.enabled) return json(403, { error: 'Session not active', sessionOffline: true });
      const ev = `data: ${JSON.stringify({
        type: 'PUSH_TO_HOST',
        songs: Array.isArray(payload && payload.songs) ? payload.songs : [],
        agendaItems: Array.isArray(payload && payload.agendaItems) ? payload.agendaItems : [],
        operatorName: (payload && payload.operatorName) || 'Remote Operator',
        timestamp: Date.now()
      })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(200, { success: true, message: 'Changes sent to Host Studio.' });
    });
    return;
  }

  // GET /api/session/catalog — returns active control catalog
  if (pathname === '/api/session/catalog' && req.method === 'GET') {
    json(200, controlCatalog);
    return;
  }

  // ── Operator Join/Leave ─────────────────────────────────────────────────────

  // POST /api/session/join — operator registers with persistent deviceId
  if (pathname === '/api/session/join' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (!remoteSession.enabled) return json(403, { error: 'Session not active', sessionOffline: true });
      const deviceId = (payload.deviceId && typeof payload.deviceId === 'string') 
        ? payload.deviceId.trim() 
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const name = (payload.name || 'Remote Operator').trim().slice(0, 40);
      
      // Check if device already exists in list (same browser refreshing)
      let opEntry = remoteSession.connectedOperators.find(o => o.deviceId === deviceId);
      let operatorId;
      if (opEntry) {
        operatorId = opEntry.id;
        opEntry.name = name;
        opEntry.joinedAt = Date.now();
      } else {
        operatorId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        opEntry = { id: operatorId, deviceId, name, joinedAt: Date.now() };
        remoteSession.connectedOperators.push(opEntry);
      }

      // Notify host of updated operators list & count
      const ev = `data: ${JSON.stringify({ type: 'OPERATORS_UPDATED', operators: remoteSession.connectedOperators, count: remoteSession.connectedOperators.length, operatorId, name })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });

      json(200, {
        operatorId,
        deviceId,
        name,
        privileges: remoteSession.privileges,
        importMode: remoteSession.importMode,
        catalog: controlCatalog,
        hostSpeechState: hostSpeechState,
      });
    });
    return;
  }

  // POST /api/session/leave — operator leaves
  if (pathname === '/api/session/leave' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, {});
      const operatorId = payload.operatorId;
      const deviceId = payload.deviceId;
      remoteSession.connectedOperators = remoteSession.connectedOperators.filter(o => 
        o.id !== operatorId && (!deviceId || o.deviceId !== deviceId)
      );
      if (operatorId) operatorClients.delete(operatorId);
      const ev = `data: ${JSON.stringify({ type: 'OPERATORS_UPDATED', operators: remoteSession.connectedOperators, count: remoteSession.connectedOperators.length, operatorId })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(200, { success: true });
    });
    return;
  }

  // GET /api/operator-events/:operatorId — SSE channel for privilege updates & live tracking
  if (pathname.startsWith('/api/operator-events/') && req.method === 'GET') {
    if (!remoteSession.enabled) { json(403, { error: 'Session not active' }); return; }
    const operatorId = pathname.split('/').pop();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    // Send current privileges, catalog & host speech state immediately
    res.write(`data: ${JSON.stringify({ type: 'PRIVILEGE_UPDATE', privileges: remoteSession.privileges, importMode: remoteSession.importMode, sessionEnabled: remoteSession.enabled })}\n\n`);
    if (controlCatalog && (controlCatalog.songs?.length || controlCatalog.agendaItems?.length)) {
      res.write(`data: ${JSON.stringify({ type: 'CATALOG_PUSHED', catalog: controlCatalog })}\n\n`);
    }
    if (hostSpeechState) {
      res.write(`data: ${JSON.stringify({ type: 'SPEECH_AI_UPDATE', hostSpeechState, fullSync: true })}\n\n`);
    }

    if (operatorClients.has(operatorId)) {
      try { operatorClients.get(operatorId).end(); } catch (e) {}
    }
    operatorClients.set(operatorId, res);

    req.on('close', () => {
      operatorClients.delete(operatorId);
      remoteSession.connectedOperators = remoteSession.connectedOperators.filter(o => o.id !== operatorId);
      const ev = `data: ${JSON.stringify({ type: 'OPERATORS_UPDATED', operators: remoteSession.connectedOperators, count: remoteSession.connectedOperators.length, operatorId })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
    });
    return;
  }

  // ── Import Requests ─────────────────────────────────────────────────────────

  // POST /api/import-request — operator proposes a new song (request mode)
  if (pathname === '/api/import-request' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Bad JSON' });
      if (!remoteSession.enabled) return json(403, { error: 'Session not active' });
      const importId = `imp_${Date.now()}`;
      const operator = remoteSession.connectedOperators.find(o => o.id === payload.operatorId) || { name: 'Operator' };
      const entry = {
        id: importId,
        operatorId: payload.operatorId,
        operatorName: operator.name,
        song: payload.song,
        timestamp: Date.now(),
      };
      remoteSession.pendingImports.push(entry);
      // Notify host
      const ev = `data: ${JSON.stringify({ type: 'IMPORT_REQUEST', ...entry })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
      json(202, { accepted: true, importId, message: 'Song sent to host for approval. You can project it in the meantime.' });
    });
    return;
  }

  // POST /api/import-request/:importId/accept — host accepts a pending import
  if (pathname.match(/^\/api\/import-request\/[^/]+\/accept$/) && req.method === 'POST') {
    const importId = pathname.split('/')[3];
    const entry = remoteSession.pendingImports.find(e => e.id === importId);
    if (!entry) return json(404, { error: 'Import request not found' });
    remoteSession.pendingImports = remoteSession.pendingImports.filter(e => e.id !== importId);
    // Forward as CATALOG_UPDATE to host control channel
    const ev = `data: ${JSON.stringify({ type: 'IMPORT_ACCEPTED', importId, song: entry.song })}\n\n`;
    controlClients.forEach(c => { try { c.write(ev); } catch {} });
    // Notify operator
    if (entry.operatorId && operatorClients.has(entry.operatorId)) {
      operatorClients.get(entry.operatorId).write(`data: ${JSON.stringify({ type: 'IMPORT_ACCEPTED', importId, songTitle: entry.song.title })}\n\n`);
    }
    json(200, { success: true });
    return;
  }

  // POST /api/import-request/:importId/dismiss — host dismisses
  if (pathname.match(/^\/api\/import-request\/[^/]+\/dismiss$/) && req.method === 'POST') {
    const importId = pathname.split('/')[3];
    remoteSession.pendingImports = remoteSession.pendingImports.filter(e => e.id !== importId);
    json(200, { success: true });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXISTING ENDPOINTS (preserved, upgraded)
  // ─────────────────────────────────────────────────────────────────────────────

  // Legacy status endpoint — kept for backward compat
  if (pathname === '/api/remote-server/status' && req.method === 'GET') {
    json(200, { enabled: remoteSession.enabled });
    return;
  }

  // Toggle remote server endpoint
  if (pathname === '/api/remote-server/toggle' && req.method === 'POST') {
    remoteSession.enabled = !remoteSession.enabled;
    if (remoteSession.enabled) {
      remoteSession.privileges = { ...FULL_CONTROL_PRIVILEGES };
      remoteSession.importMode = 'direct';
      broadcastPrivilegeUpdate();
      const ev = `data: ${JSON.stringify({ type: 'REMOTE_SERVER_STATUS', enabled: true, session: remoteSession })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
    } else {
      remoteSession.connectedOperators = [];
      remoteSession.pendingImports = [];
      broadcastToOperators({ type: 'SESSION_ENDED' });
      const ev = `data: ${JSON.stringify({ type: 'REMOTE_SERVER_STATUS', enabled: false })}\n\n`;
      controlClients.forEach(c => { try { c.write(ev); } catch {} });
    }
    json(200, { success: true, enabled: remoteSession.enabled });
    return;
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    json(200, currentState);
    return;
  }

  if (pathname === '/api/network' && req.method === 'GET') {
    const addresses = getLanAddresses();
    json(200, { addresses, preferredAddress: addresses[0] || null, port: PORT, remoteServerEnabled: remoteSession.enabled });
    return;
  }

  if (pathname === '/api/sync' && req.method === 'POST') {
    readBody((err, payload) => {
      if (err) return json(400, { error: 'Invalid JSON' });
      currentState = { ...payload, _timestamp: Date.now() };
      publishState();
      json(200, { success: true, timestamp: currentState._timestamp });
    });
    return;
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify(currentState)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (pathname === '/api/control' && req.method === 'POST') {
    readBody((err, command) => {
      if (err || !command || typeof command.type !== 'string') return json(400, { error: 'Invalid command' });

      if (command._fromRemote) {
        // Block if session is not active
        if (!remoteSession.enabled) {
          return json(403, { error: 'Remote session is offline', sessionOffline: true });
        }
        // Validate against active privileges
        if (!isCommandAllowed(command, remoteSession.privileges)) {
          return json(403, { error: 'Action not permitted by host', privilegeDenied: true, type: command.type });
        }
      }

      // Zero-latency direct broadcast to OBS / Displays / Projector
      if (command.type === 'PROJECT' && typeof command.text === 'string') {
        const isLex = Boolean(command.isLexicon || (command.slideId && command.slideId.startsWith('lexicon_')));
        currentState = {
          ...currentState,
          text: command.text,
          reference: command.reference || '',
          slideId: command.slideId || ('remote_' + Date.now()),
          contentType: command.contentType || (isLex ? 'lexicon' : 'bible'),
          isLexicon: isLex,
          lexiconData: isLex ? (command.lexiconData || null) : null,
          lexiconStyle: isLex ? (command.lexiconStyle || null) : null,
          lexiconDisplayMode: isLex ? (command.lexiconDisplayMode || null) : null,
          concordancePosition: isLex ? (command.concordancePosition || (command.lexiconData && command.lexiconData.position) || null) : null,
          englishWord: isLex ? (command.englishWord || '') : '',
          compareData: command.compareData || null,
          clear: false,
          blackout: false,
          _timestamp: Date.now()
        };
        publishState();
      } else if (command.type === 'CLEAR') {
        currentState = {
          ...currentState,
          clear: true,
          blackout: false,
          _timestamp: Date.now()
        };
        publishState();
      } else if (command.type === 'BLACKOUT') {
        currentState = {
          ...currentState,
          blackout: true,
          clear: false,
          _timestamp: Date.now()
        };
        publishState();
      }

      // Concurrently forward command to host studio
      const event = `data: ${JSON.stringify(command)}\n\n`;
      controlClients.forEach(client => {
        try { client.write(event); } catch { controlClients.delete(client); }
      });
      json(202, { accepted: true });
    });
    return;
  }

  if (pathname === '/api/control-events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    if (hostSpeechState) {
      res.write(`data: ${JSON.stringify({ type: 'SPEECH_AI_UPDATE', hostSpeechState, fullSync: true })}\n\n`);
    }
    controlClients.add(res);
    req.on('close', () => controlClients.delete(res));
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLOUD LYRICS & ONLINE BIBLES API PROXY
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper: Parse lyrics text into structured presentation stanzas
  function parseLyricsToStanzas(rawLyrics, fallbackTitle = '') {
    if (!rawLyrics || typeof rawLyrics !== 'string') return [{ type: 'Verse 1', text: fallbackTitle || 'Lyrics' }];
    // Remove LRC timestamps e.g. [01:23.45]
    let clean = rawLyrics.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    const rawLines = clean.split(/\r?\n/).map(l => l.trim());
    const stanzas = [];
    let currentType = 'Verse 1';
    let currentLines = [];
    let verseCounter = 1;
    let chorusCounter = 1;
    let bridgeCounter = 1;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) {
        if (currentLines.length > 0) {
          stanzas.push({ type: currentType, text: currentLines.join('\n') });
          currentLines = [];
          if (currentType.startsWith('Verse')) {
            verseCounter++;
            currentType = `Verse ${verseCounter}`;
          }
        }
        continue;
      }

      const headerMatch = line.match(/^\[?(verse|chorus|bridge|pre-chorus|tag|intro|outro|v|c|b|p)\s*(\d*)\]?:?$/i);
      if (headerMatch) {
        if (currentLines.length > 0) {
          stanzas.push({ type: currentType, text: currentLines.join('\n') });
          currentLines = [];
        }
        const rawTag = headerMatch[1].toLowerCase();
        const num = headerMatch[2];
        if (rawTag.startsWith('v')) {
          currentType = num ? `Verse ${num}` : `Verse ${verseCounter++}`;
        } else if (rawTag.startsWith('c')) {
          currentType = num ? `Chorus ${num}` : (chorusCounter > 1 ? `Chorus ${chorusCounter}` : 'Chorus');
          chorusCounter++;
        } else if (rawTag.startsWith('b')) {
          currentType = num ? `Bridge ${num}` : (bridgeCounter > 1 ? `Bridge ${bridgeCounter}` : 'Bridge');
          bridgeCounter++;
        } else if (rawTag.startsWith('p')) {
          currentType = 'Pre-Chorus';
        } else {
          currentType = rawTag.charAt(0).toUpperCase() + rawTag.slice(1);
        }
        continue;
      }

      currentLines.push(line);
      // Chunk every 4 lines if no explicit headers and paragraph is long
      if (currentLines.length >= 4 && (i + 1 < rawLines.length && !rawLines[i + 1])) {
        stanzas.push({ type: currentType, text: currentLines.join('\n') });
        currentLines = [];
        if (currentType.startsWith('Verse')) {
          verseCounter++;
          currentType = `Verse ${verseCounter}`;
        }
      }
    }

    if (currentLines.length > 0) {
      stanzas.push({ type: currentType, text: currentLines.join('\n') });
    }

    return stanzas.length > 0 ? stanzas : [{ type: 'Verse 1', text: rawLyrics.trim() }];
  }

  // GET /api/lyrics/search — dynamic online lyrics search across global repositories with fallback
  if (pathname === '/api/lyrics/search' && req.method === 'GET') {
    const q = reqUrl.searchParams.get('q') || '';
    const artist = reqUrl.searchParams.get('artist') || '';
    const title = reqUrl.searchParams.get('title') || '';

    const queryTerm = (q || `${title} ${artist}`).trim();
    if (!queryTerm) {
      json(200, { results: [] });
      return;
    }

    const cacheKey = queryTerm.toLowerCase();
    const cached = lyricsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < LYRICS_CACHE_TTL_MS)) {
      json(200, { results: cached.results, count: cached.results.length, query: queryTerm, cached: true });
      return;
    }

    (async () => {
      let results = [];
      let lastErr = null;

      // Provider 1: lrclib.net with automatic 1x retry on 503 / 429
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(queryTerm)}`;
        let response = await fetch(searchUrl, {
          headers: { 'User-Agent': 'GinomaiPro/1.0' },
          signal: AbortSignal.timeout(5000)
        });

        // Transient 503 or 429 backoff retry
        if (response.status === 503 || response.status === 429 || response.status === 502) {
          await new Promise(r => setTimeout(r, 400));
          response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'GinomaiPro/1.0' },
            signal: AbortSignal.timeout(5000)
          });
        }

        if (response.ok) {
          const data = await response.json();
          results = (Array.isArray(data) ? data : [])
            .filter(item => (item.plainLyrics || item.syncedLyrics) && (item.trackName || item.name))
            .map(item => {
              const rawLyrics = item.plainLyrics || item.syncedLyrics || '';
              const trackTitle = (item.trackName || item.name || 'Untitled Song').trim();
              const trackArtist = (item.artistName || artist || 'Unknown Artist').trim();
              const stanzas = parseLyricsToStanzas(rawLyrics, trackTitle);
              const previewSnippet = stanzas.map(s => s.text).join(' ').slice(0, 160) + '...';

              return {
                id: item.id ? `lrc_${item.id}` : `song_cloud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: trackTitle,
                author: trackArtist,
                album: item.albumName || '',
                duration: item.duration || 0,
                songbook: 'Cloud Worship',
                previewText: previewSnippet,
                stanzas: stanzas
              };
            });
        } else {
          lastErr = new Error(`Lyrics API responded with status ${response.status}`);
        }
      } catch (err) {
        lastErr = err;
      }

      // Provider 2 Fallback: lyrics.ovh (if Provider 1 failed, 503, or returned 0 results)
      if (!results || results.length === 0) {
        try {
          const suggestUrl = `https://api.lyrics.ovh/suggest/${encodeURIComponent(queryTerm)}`;
          const suggestRes = await fetch(suggestUrl, { signal: AbortSignal.timeout(4500) });
          if (suggestRes.ok) {
            const suggestData = await suggestRes.json();
            const tracks = (suggestData.data || []).slice(0, 5);
            const fetched = await Promise.allSettled(
              tracks.map(async t => {
                const trackArtist = (t.artist?.name || artist || 'Unknown Artist').trim();
                const trackTitle = (t.title || 'Untitled Song').trim();
                const lr = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(trackArtist)}/${encodeURIComponent(trackTitle)}`, {
                  signal: AbortSignal.timeout(3500)
                });
                if (!lr.ok) return null;
                const ld = await lr.json();
                if (!ld || !ld.lyrics) return null;
                const stanzas = parseLyricsToStanzas(ld.lyrics, trackTitle);
                const previewSnippet = stanzas.map(s => s.text).join(' ').slice(0, 160) + '...';
                return {
                  id: `ovh_${t.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  title: trackTitle,
                  author: trackArtist,
                  album: t.album?.title || '',
                  duration: t.duration || 0,
                  songbook: 'Cloud Worship',
                  previewText: previewSnippet,
                  stanzas: stanzas
                };
              })
            );
            results = fetched.map(f => f.value).filter(Boolean);
          }
        } catch (ovhErr) {
          // secondary fallback failed
        }
      }

      // Deduplicate results by title + artist
      const seen = new Set();
      const uniqueResults = [];
      for (const item of results) {
        const key = `${item.title.toLowerCase()}___${item.author.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(item);
        }
      }

      if (uniqueResults.length > 0) {
        if (lyricsCache.size > 500) {
          const firstKey = lyricsCache.keys().next().value;
          lyricsCache.delete(firstKey);
        }
        lyricsCache.set(cacheKey, { results: uniqueResults, timestamp: Date.now() });
        json(200, { results: uniqueResults, count: uniqueResults.length, query: queryTerm });
      } else {
        if (lastErr) {
          console.info(`[Ginomai Pro] Cloud lyrics provider info: ${lastErr.message}. Fallback attempted.`);
        }
        json(200, {
          results: [],
          count: 0,
          query: queryTerm,
          temporarilyUnavailable: true,
          message: 'Cloud lyrics service is temporarily busy (503). You can paste lyrics into Song Creator or search local songs.'
        });
      }
    })();
    return;
  }

  // GET /api/bibles/catalog — returns all available cloud Bible translations
  if (pathname === '/api/bibles/catalog' && req.method === 'GET') {
    const manifestPath = path.join(PUBLIC_DIR, 'bibles', 'manifest.json');
    fs.readFile(manifestPath, 'utf8', (err, content) => {
      if (!err && content) {
        try {
          const manifest = JSON.parse(content);
          json(200, { bibles: manifest, count: manifest.length });
          return;
        } catch (e) {}
      }
      // Fallback list of top bibles
      json(200, {
        bibles: [
          { code: "KJV", name: "King James Version", lang: "English", size: "4.6 MB", booksCount: 66, url: "bibles/KJV.json" },
          { code: "NIV", name: "New International Version", lang: "English", size: "4.3 MB", booksCount: 66, url: "bibles/NIV.json" },
          { code: "NKJV", name: "New King James Version", lang: "English", size: "4.5 MB", booksCount: 66, url: "bibles/NKJV.json" },
          { code: "ESV", name: "English Standard Version", lang: "English", size: "4.4 MB", booksCount: 66, url: "bibles/ESV.json" },
          { code: "NLT", name: "New Living Translation", lang: "English", size: "4.4 MB", booksCount: 66, url: "bibles/NLT.json" },
          { code: "AMP", name: "Amplified Bible", lang: "English", size: "5.2 MB", booksCount: 66, url: "bibles/AMP.json" },
          { code: "CSB", name: "Christian Standard Bible", lang: "English", size: "4.4 MB", booksCount: 66, url: "bibles/CSB.json" },
          { code: "BSB", name: "Berean Standard Bible", lang: "English", size: "4.3 MB", booksCount: 66, url: "bibles/BSB.json" },
          { code: "NASB", name: "New American Standard Bible", lang: "English", size: "4.5 MB", booksCount: 66, url: "bibles/NASB.json" },
          { code: "TPT", name: "The Passion Translation", lang: "English", size: "3.2 MB", booksCount: 66, url: "bibles/TPT.json" }
        ]
      });
    });
    return;
  }

  // GET /api/bibles/download/:code — on-demand download of Bible translation JSON
  if (pathname.startsWith('/api/bibles/download/') && req.method === 'GET') {
    const code = pathname.split('/').pop().toUpperCase().trim();
    const bibleFilePath = path.join(PUBLIC_DIR, 'bibles', `${code}.json`);
    
    fs.readFile(bibleFilePath, 'utf8', (err, data) => {
      if (!err && data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
        return;
      }
      json(404, { error: `Bible translation "${code}" not found on server.` });
    });
    return;
  }

  if (pathname === '/api/catalog' && req.method === 'GET') {
    json(200, controlCatalog);
    return;
  }

  if (pathname === '/api/catalog' && req.method === 'POST') {
    readBody((err, catalog) => {
      if (err || !catalog || typeof catalog !== 'object') return json(400, { error: 'Invalid catalog' });
      controlCatalog = {
        bibleVersions: Array.isArray(catalog.bibleVersions) ? catalog.bibleVersions : ['KJV'],
        songs: Array.isArray(catalog.songs) ? catalog.songs : [],
        agendaItems: Array.isArray(catalog.agendaItems) ? catalog.agendaItems : [],
        bible: (catalog.bible && typeof catalog.bible === 'object') ? catalog.bible : (controlCatalog.bible || {})
      };
      currentState = { ...currentState, catalogVersion: (currentState.catalogVersion || 0) + 1, _timestamp: Date.now() };
      publishState();
      json(200, { success: true });
    });
    return;
  }

  // GET /api/lexicon/:id — lookup Greek or Hebrew Strong's entry
  if (pathname.startsWith('/api/lexicon/') && req.method === 'GET') {
    const rawId = pathname.split('/').pop().toUpperCase();
    const normalizedId = rawId.replace(/^([GH])0+(\d+)/, '$1$2');
    if (!lexiconCache) {
      try {
        const lexPath = path.join(PUBLIC_DIR, 'lexicon', 'strongs_unified.json');
        if (fs.existsSync(lexPath)) {
          lexiconCache = JSON.parse(fs.readFileSync(lexPath, 'utf8'));
        }
      } catch (e) {
        console.error('[Lexicon] Error loading cache:', e);
      }
    }
    const entry = lexiconCache ? (lexiconCache[rawId] || lexiconCache[normalizedId]) : null;
    if (entry) {
      json(200, entry);
    } else {
      json(404, { error: `Strong's entry "${rawId}" not found.` });
    }
    return;
  }

  // ─── Static File Server ───────────────────────────────────────────────────
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (ext === '.css' || ext === '.js' || ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

let activeServer = null;

function startServer(port = PORT, callback) {
  if (activeServer && activeServer.listening) {
    if (callback) callback(null, activeServer, currentBoundPort);
    return activeServer;
  }

  let attemptPort = Number(port) || 8500;
  const maxAttempts = 20;
  let attempts = 0;

  function tryListen() {
    server.removeAllListeners('error');
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        if (attempts < maxAttempts) {
          console.warn(`[Ginomai Pro] Port ${attemptPort} in use, trying next port ${attemptPort + 1}...`);
          attemptPort++;
          setTimeout(tryListen, 50);
        } else {
          console.error(`[Ginomai Pro] Could not bind after ${maxAttempts} attempts:`, err);
          if (callback) callback(err, null, attemptPort);
        }
      } else {
        console.error('[Ginomai Pro] Server error:', err);
        if (callback) callback(err, null, attemptPort);
      }
    });

    server.listen(attemptPort, () => {
      activeServer = server;
      currentBoundPort = attemptPort;
      const lanIp = getLanAddresses()[0];
      console.log(`=======================================================`);
      console.log(` Ginomai Pro — The Word in Motion (Studio Server)`);
      console.log(` Host Console:       http://localhost:${attemptPort}`);
      if (lanIp) {
        console.log(` Remote Operator:   http://${lanIp}:${attemptPort}/operator.html`);
        console.log(` Sanctuary Display: http://${lanIp}:${attemptPort}/display.html?target=sanctuary`);
        console.log(` Livestream OBS:    http://${lanIp}:${attemptPort}/display.html?target=livestream`);
      }
      console.log(`=======================================================`);
      if (callback) callback(null, activeServer, attemptPort);
    });
  }

  tryListen();
  return server;
}

function stopServer(callback) {
  if (activeServer) {
    activeServer.close(() => {
      activeServer = null;
      if (callback) callback();
    });
  } else if (callback) {
    callback();
  }
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  server,
  startServer,
  stopServer,
  getLanAddresses,
  getCurrentState: () => currentState,
  publishState
};

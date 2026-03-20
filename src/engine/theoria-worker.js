// Web Worker: loads Theoria WASM engine (non-ASYNCIFY build)
//
// Supports two evaluation modes:
//   'theoria' — nn-theoria.nnue (58MB, custom Theoria NNUE, big net)
//   'fast'    — nn-baff1ede1f90.nnue (3.4MB, Stockfish small net)
//
// Send '__init__' or { type: '__init__', mode: 'theoria'|'fast' } to start.

const NNUE_FILES = {
  theoria: { name: 'nn-theoria.nnue',      evalFile: 'EvalFile',      useSmallNet: false },
  fast:    { name: 'nn-baff1ede1f90.nnue', evalFile: 'EvalFileSmall', useSmallNet: true  },
};

let engine = null;
let pendingCommands = [];
let engineReady = false;
let currentMode = 'theoria';

self.onmessage = function(e) {
  const msg = e.data;

  if (msg === '__init__' || (msg && msg.type === '__init__')) {
    if (msg && msg.mode) currentMode = msg.mode;
    initEngine();
    return;
  }

  if (!engineReady) {
    pendingCommands.push(msg);
    return;
  }

  sendCommand(msg);
};

function sendCommand(cmd) {
  try {
    if (engine && engine.ccall) {
      engine.ccall('command', 'number', ['string'], [cmd]);
    }
  } catch (err) {
    self.postMessage('info string [error] ccall: ' + err.message);
  }
}

// ── IndexedDB cache ──────────────────────────────────────────────────────────

const DB_NAME    = 'theoria-nnue-cache';
const DB_VERSION = 1;
const DB_STORE   = 'nnue-files';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess       = e => resolve(e.target.result);
    req.onerror         = e => reject(e.target.error);
  });
}

async function cacheGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function cachePut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ── NNUE fetch with caching ───────────────────────────────────────────────────

async function loadNNUE(filename) {
  let db = null;
  try { db = await openDB(); } catch {}

  // Try cache first
  if (db) {
    try {
      const cached = await cacheGet(db, filename);
      if (cached) {
        self.postMessage('info string Worker: ' + filename + ' loaded from cache');
        return cached;
      }
    } catch {}
  }

  // Fetch from server
  self.postMessage('info string Worker: downloading ' + filename + '...');
  try {
    const resp = await fetch('/wasm/' + filename);
    if (!resp.ok) {
      self.postMessage('info string Worker: ' + filename + ' not found (HTTP ' + resp.status + ')');
      return null;
    }
    const data = new Uint8Array(await resp.arrayBuffer());
    self.postMessage('info string Worker: ' + filename + ' downloaded (' +
      (data.length / 1024 / 1024).toFixed(1) + ' MB)');

    // Store in cache
    if (db) {
      try { await cachePut(db, filename, data); } catch {}
    }
    return data;
  } catch (e) {
    self.postMessage('info string Worker: fetch error ' + filename + ': ' + e.message);
    return null;
  }
}

// ── Engine init ───────────────────────────────────────────────────────────────

async function initEngine() {
  try {
    const cfg = NNUE_FILES[currentMode] || NNUE_FILES.theoria;
    self.postMessage('info string Worker: mode=' + currentMode + ', loading ' + cfg.name);

    const nnueData = await loadNNUE(cfg.name);

    self.postMessage('info string Worker: loading WASM module...');
    importScripts('/wasm/theoria.js');

    if (typeof Theoria !== 'function') {
      self.postMessage('info string [error] Theoria is not a function');
      return;
    }

    let gotEngineReady = false;

    const moduleConfig = {
      locateFile: function(path) { return '/wasm/' + path; },

      preRun: [function() {
        const FS = this.FS || (typeof Module !== 'undefined' && Module.FS);
        if (FS && nnueData) {
          // Write NNUE under both its real name and the slot name the engine expects
          FS.writeFile('/' + cfg.name, nnueData);
          self.postMessage('info string Worker: ' + cfg.name + ' written to FS');
        }
      }],

      print: function(text) {
        if (text === 'info string engine ready') gotEngineReady = true;
        self.postMessage(text);
      },

      printErr: function(text) {
        if (text.includes('Blocking') || text.includes('pre-main')) return;
        self.postMessage('info string [stderr] ' + text);
      },
    };

    self.postMessage('info string Worker: instantiating engine...');
    engine = await Theoria(moduleConfig);
    self.postMessage('info string Worker: module loaded');

    // Wait for engine ready signal
    for (let i = 0; i < 100 && !gotEngineReady; i++) {
      await new Promise(r => setTimeout(r, 100));
    }

    // Point the engine to the correct NNUE slot
    if (engine.FS && nnueData) {
      try { engine.FS.stat('/' + cfg.name); }
      catch {
        engine.FS.writeFile('/' + cfg.name, nnueData);
      }
    }

    // Configure NNUE routing
    sendCommand('setoption name ' + cfg.evalFile + ' value ' + cfg.name);
    sendCommand('setoption name UseSmallNet value ' + (cfg.useSmallNet ? 'true' : 'false'));

    engineReady = true;
    self.postMessage('__ready__');

    // Flush pending commands
    for (const cmd of pendingCommands) sendCommand(cmd);
    pendingCommands = [];

  } catch (err) {
    self.postMessage('info string [error] init failed: ' + err.message + '\n' + (err.stack || ''));
  }
}

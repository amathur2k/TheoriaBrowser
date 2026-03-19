// Web Worker: loads Theoria WASM engine (non-ASYNCIFY build)
//
// main() runs to completion during Theoria() init, then
// emscripten_set_main_loop polls the command queue every ~10ms.
// We send commands via ccall('command') which pushes to the C++ queue.

let engine = null;
let pendingCommands = [];
let engineReady = false;

self.onmessage = function(e) {
  const cmd = e.data;

  if (cmd === '__init__') {
    initEngine();
    return;
  }

  if (!engineReady) {
    pendingCommands.push(cmd);
    return;
  }

  sendCommand(cmd);
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

async function fetchNNUE(name) {
  try {
    const resp = await fetch('/wasm/' + name);
    if (resp.ok) {
      const data = new Uint8Array(await resp.arrayBuffer());
      self.postMessage('info string Worker: loaded ' + name + ' (' + (data.length / 1024 / 1024).toFixed(1) + ' MB)');
      return data;
    }
    self.postMessage('info string Worker: ' + name + ' not found (HTTP ' + resp.status + ')');
  } catch (e) {
    self.postMessage('info string Worker: fetch error ' + name + ': ' + e.message);
  }
  return null;
}

async function initEngine() {
  try {
    self.postMessage('info string Worker: fetching NNUE files...');

    // Fetch both NNUE files in parallel
    const [nnueBig, nnueSmall] = await Promise.all([
      fetchNNUE('nn-b1a57edbea57.nnue'),
      fetchNNUE('nn-baff1ede1f90.nnue'),
    ]);

    self.postMessage('info string Worker: loading WASM module...');
    importScripts('/wasm/theoria.js');

    if (typeof Theoria !== 'function') {
      self.postMessage('info string [error] Theoria is ' + typeof Theoria + ', not a function');
      return;
    }

    let gotEngineReady = false;

    const moduleConfig = {
      locateFile: function(path) {
        return '/wasm/' + path;
      },

      // Write NNUE files to virtual FS before main() runs
      preRun: [function() {
        // In non-ASYNCIFY mode with MODULARIZE, FS is available via Module
        const FS = this.FS || (typeof Module !== 'undefined' && Module.FS);
        if (FS) {
          if (nnueBig) {
            FS.writeFile('/nn-b1a57edbea57.nnue', nnueBig);
            self.postMessage('info string Worker: big NNUE written to FS');
          }
          if (nnueSmall) {
            FS.writeFile('/nn-baff1ede1f90.nnue', nnueSmall);
            self.postMessage('info string Worker: small NNUE written to FS');
          }
        } else {
          self.postMessage('info string Worker: WARNING - FS not available in preRun, will reload via setoption');
        }
      }],

      print: function(text) {
        // "info string engine ready" signals main() has finished init
        if (text === 'info string engine ready') {
          gotEngineReady = true;
        }
        self.postMessage(text);
      },

      printErr: function(text) {
        if (text.includes('Blocking')) return;
        if (text.includes('pre-main')) return;
        self.postMessage('info string [stderr] ' + text);
      },
    };

    self.postMessage('info string Worker: instantiating engine...');
    engine = await Theoria(moduleConfig);
    self.postMessage('info string Worker: module loaded');

    // With emscripten_set_main_loop (no ASYNCIFY), main() runs to completion
    // during Theoria(). The "info string engine ready" message confirms init finished.
    if (!gotEngineReady) {
      // Wait a bit in case main() is still finishing
      for (let i = 0; i < 100 && !gotEngineReady; i++) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (!gotEngineReady) {
      self.postMessage('info string Worker: WARNING - no "engine ready" signal after 10s');
    }

    // If preRun didn't have FS, write files now and reload via UCI
    if (engine.FS) {
      const hasFiles = (() => {
        try { engine.FS.stat('/nn-b1a57edbea57.nnue'); return true; }
        catch { return false; }
      })();
      if (!hasFiles && nnueBig) {
        engine.FS.writeFile('/nn-b1a57edbea57.nnue', nnueBig);
        engine.FS.writeFile('/nn-baff1ede1f90.nnue', nnueSmall);
        self.postMessage('info string Worker: NNUE written to FS (post-init)');
        // Reload via UCI
        sendCommand('setoption name EvalFile value nn-b1a57edbea57.nnue');
        sendCommand('setoption name EvalFileSmall value nn-baff1ede1f90.nnue');
      }
    }

    engineReady = true;
    self.postMessage('__ready__');

    // Flush pending commands
    for (const cmd of pendingCommands) {
      sendCommand(cmd);
    }
    pendingCommands = [];

  } catch (err) {
    self.postMessage('info string [error] init failed: ' + err.message + '\n' + (err.stack || ''));
  }
}

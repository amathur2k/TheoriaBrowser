/**
 * Promise-based UCI wrapper for Theoria engine running in a Web Worker.
 * Follows the stockfish.js loadEngine.js pattern.
 */
export class TheoriaEngine {
  constructor() {
    this.worker = null;
    this.listeners = [];
    this.ready = false;
    this.analyzing = false;
    this._onInfoCallback = null;
  }

  /**
   * Initialize the engine worker and wait for UCI handshake.
   * @param {function} [onStatus] - Optional callback for status messages during loading
   */
  async init(onStatus) {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('/src/engine/theoria-worker.js');
      } catch (err) {
        reject(new Error('Failed to create worker: ' + err.message));
        return;
      }

      this.worker.onmessage = (e) => {
        this._dispatch(e.data);
      };

      this.worker.onerror = (e) => {
        reject(new Error('Worker error: ' + e.message));
      };

      // Forward status messages during loading
      if (onStatus) {
        this._addListener(onStatus);
      }

      // Wait for __ready__ signal from worker
      const readyHandler = (line) => {
        if (line === '__ready__') {
          this._removeListener(readyHandler);
          if (onStatus) this._removeListener(onStatus);
          // Now do UCI handshake
          this._uciHandshake().then(resolve).catch(reject);
        }
      };

      this._addListener(readyHandler);
      this.worker.postMessage('__init__');
    });
  }

  async _uciHandshake() {
    await this._sendAndWait('uci', 'uciok');
    this.ready = true;
    await this.isReady();
  }

  /**
   * Send "isready" and wait for "readyok".
   */
  async isReady() {
    return this._sendAndWait('isready', 'readyok');
  }

  /**
   * Set a UCI option.
   */
  async setOption(name, value) {
    this._send(`setoption name ${name} value ${value}`);
    return this.isReady();
  }

  /**
   * Set the current position.
   * @param {string} fen - FEN string (use 'startpos' for initial position)
   * @param {string[]} moves - Array of UCI moves
   */
  setPosition(fen, moves = []) {
    let cmd;
    if (fen === 'startpos') {
      cmd = 'position startpos';
    } else {
      cmd = `position fen ${fen}`;
    }
    if (moves.length > 0) {
      cmd += ' moves ' + moves.join(' ');
    }
    this._send(cmd);
  }

  /**
   * Start analysis.
   * @param {object} options - { depth, movetime, nodes, infinite }
   * @param {function} onInfo - Callback for each info line
   * @returns {Promise<string>} - Resolves with bestmove line
   */
  go(options = {}, onInfo = null) {
    this._onInfoCallback = onInfo;
    this.analyzing = true;

    return new Promise((resolve) => {
      const handler = (line) => {
        if (line.startsWith('info ') && this._onInfoCallback) {
          this._onInfoCallback(parseInfo(line));
        }
        if (line.startsWith('bestmove')) {
          this._removeListener(handler);
          this.analyzing = false;
          this._onInfoCallback = null;
          resolve(line);
        }
      };
      this._addListener(handler);

      let cmd = 'go';
      if (options.depth) cmd += ` depth ${options.depth}`;
      if (options.movetime) cmd += ` movetime ${options.movetime}`;
      if (options.nodes) cmd += ` nodes ${options.nodes}`;
      if (options.infinite) cmd += ' infinite';
      this._send(cmd);
    });
  }

  /**
   * Stop current analysis.
   */
  stop() {
    if (this.analyzing) {
      this._send('stop');
    }
  }

  /**
   * Quit the engine and terminate the worker.
   */
  quit() {
    this._send('quit');
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }

  // --- Internal methods ---

  _send(cmd) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  _sendAndWait(cmd, waitFor) {
    return new Promise((resolve) => {
      const handler = (line) => {
        if (line === waitFor || line.startsWith(waitFor)) {
          this._removeListener(handler);
          resolve(line);
        }
      };
      this._addListener(handler);
      this._send(cmd);
    });
  }

  _addListener(fn) {
    this.listeners.push(fn);
  }

  _removeListener(fn) {
    this.listeners = this.listeners.filter(l => l !== fn);
  }

  _dispatch(line) {
    if (typeof line !== 'string') return;
    for (const fn of [...this.listeners]) {
      fn(line);
    }
  }
}

/**
 * Parse a UCI "info" line into a structured object.
 */
export function parseInfo(line) {
  const info = { raw: line };
  const tokens = line.split(/\s+/);

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        info.depth = parseInt(tokens[++i]);
        break;
      case 'seldepth':
        info.seldepth = parseInt(tokens[++i]);
        break;
      case 'multipv':
        info.multipv = parseInt(tokens[++i]);
        break;
      case 'score':
        if (tokens[i + 1] === 'cp') {
          info.score = { type: 'cp', value: parseInt(tokens[i + 2]) };
          i += 2;
        } else if (tokens[i + 1] === 'mate') {
          info.score = { type: 'mate', value: parseInt(tokens[i + 2]) };
          i += 2;
        }
        break;
      case 'nodes':
        info.nodes = parseInt(tokens[++i]);
        break;
      case 'nps':
        info.nps = parseInt(tokens[++i]);
        break;
      case 'time':
        info.time = parseInt(tokens[++i]);
        break;
      case 'pv':
        info.pv = tokens.slice(i + 1);
        i = tokens.length; // pv is always last
        break;
      case 'hashfull':
        info.hashfull = parseInt(tokens[++i]);
        break;
    }
  }

  return info;
}

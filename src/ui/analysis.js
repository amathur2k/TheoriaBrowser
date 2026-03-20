import { Chess } from 'chess.js';

/**
 * Analysis panel: displays PV lines, depth, nodes, and NPS.
 */
export class AnalysisPanel {
  constructor() {
    this.depthEl = document.getElementById('depth-display');
    this.nodesEl = document.getElementById('nodes-display');
    this.npsEl = document.getElementById('nps-display');
    this.pvContainer = document.getElementById('pv-lines');
    this.statusEl = document.getElementById('engine-status');

    this.pvData = new Map(); // multipv index → info
    this.currentFen = null;
  }

  setStatus(text) {
    this.statusEl.textContent = 'Engine: ' + text;
  }

  /**
   * Set the current position FEN (for PV → SAN conversion).
   */
  setPosition(fen) {
    this.currentFen = fen;
  }

  /**
   * Update with a parsed UCI info object.
   */
  updateInfo(info) {
    if (info.depth) {
      this.depthEl.textContent = `Depth: ${info.depth}${info.seldepth ? '/' + info.seldepth : ''}`;
    }
    if (info.nodes !== undefined) {
      this.nodesEl.textContent = `Nodes: ${formatNumber(info.nodes)}`;
    }
    if (info.nps !== undefined) {
      this.npsEl.textContent = `NPS: ${formatNumber(info.nps)}`;
    }

    // Store PV data
    const pvIndex = info.multipv || 1;
    if (info.pv && info.score) {
      this.pvData.set(pvIndex, info);
      this._renderPVs();
    }
  }

  /**
   * Clear all analysis display.
   */
  clear() {
    this.pvData.clear();
    this.pvContainer.innerHTML = '';
    this.depthEl.textContent = 'Depth: -';
    this.nodesEl.textContent = 'Nodes: -';
    this.npsEl.textContent = 'NPS: -';
  }

  _renderPVs() {
    const sorted = [...this.pvData.entries()].sort((a, b) => a[0] - b[0]);
    this.pvContainer.innerHTML = '';

    for (const [, info] of sorted) {
      const div = document.createElement('div');
      div.className = 'pv-line';

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'pv-score';
      scoreSpan.textContent = formatScore(info.score);

      const movesSpan = document.createElement('span');
      movesSpan.className = 'pv-moves';
      movesSpan.textContent = this._pvToSan(info.pv);

      div.appendChild(scoreSpan);
      div.appendChild(movesSpan);
      this.pvContainer.appendChild(div);
    }
  }

  /**
   * Convert UCI PV moves to SAN notation.
   */
  _pvToSan(pvMoves) {
    if (!pvMoves || pvMoves.length === 0 || !this.currentFen) {
      return pvMoves ? pvMoves.join(' ') : '';
    }

    try {
      const tempGame = new Chess(this.currentFen);
      const sanMoves = [];

      for (let i = 0; i < Math.min(pvMoves.length, 12); i++) {
        const uci = pvMoves[i];
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;

        const turn = tempGame.turn();
        const moveNum = tempGame.moveNumber();

        const move = tempGame.move({ from, to, promotion });
        if (!move) break;

        if (turn === 'w') {
          sanMoves.push(`${moveNum}. ${move.san}`);
        } else if (i === 0) {
          sanMoves.push(`${moveNum}... ${move.san}`);
        } else {
          sanMoves.push(move.san);
        }
      }

      return sanMoves.join(' ');
    } catch {
      return pvMoves.slice(0, 12).join(' ');
    }
  }
}

/**
 * Format a UCI score for display.
 */
export function formatScore(score) {
  if (!score) return '?';
  if (score.type === 'mate') {
    return (score.value > 0 ? '+' : '') + 'M' + score.value;
  }
  const pawns = score.value / 100;
  return (pawns > 0 ? '+' : '') + pawns.toFixed(2);
}

/**
 * Format large numbers with K/M suffixes.
 */
function formatNumber(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

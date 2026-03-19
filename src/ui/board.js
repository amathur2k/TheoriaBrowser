import { Chess } from 'chess.js';

/**
 * Chess board UI with click-to-move, legal move highlighting, and game state management.
 * Uses a simple HTML table renderer with styled Unicode pieces.
 */

// Use the same glyph style for both colors — differentiate with CSS classes
const PIECE_CHARS = {
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export class BoardUI {
  /**
   * @param {string} containerId - DOM element ID for the board
   * @param {function} onMove - Callback when a move is made: (move) => void
   */
  constructor(containerId, onMove) {
    this.container = document.getElementById(containerId);
    this.game = new Chess();
    this.onMove = onMove;
    this.orientation = 'white';
    this.selectedSquare = null;
    this.legalMoves = [];
    this.moveHistory = [];
    this.currentMoveIndex = -1;

    this.render();
  }

  render() {
    const table = document.createElement('table');
    table.className = 'board-table';

    const ranks = this.orientation === 'white' ? RANKS : [...RANKS].reverse();
    const files = this.orientation === 'white' ? FILES : [...FILES].reverse();

    for (const rank of ranks) {
      const tr = document.createElement('tr');
      for (const file of files) {
        const square = file + rank;
        const td = document.createElement('td');
        const fileIdx = FILES.indexOf(file);
        const rankIdx = RANKS.indexOf(rank);
        const isLight = (fileIdx + rankIdx) % 2 === 0;
        td.className = isLight ? 'light' : 'dark';
        td.dataset.square = square;

        const piece = this.game.get(square);
        if (piece) {
          const span = document.createElement('span');
          span.className = 'piece piece-' + piece.color;
          span.textContent = PIECE_CHARS[piece.type] || '';
          td.appendChild(span);
        }

        if (this.selectedSquare === square) {
          td.classList.add('selected');
        }

        if (this.legalMoves.some(m => m.to === square)) {
          td.classList.add('legal-target');
          if (piece) {
            td.classList.add('has-piece');
          }
        }

        td.addEventListener('click', () => this._onSquareClick(square));
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    this.container.innerHTML = '';
    this.container.appendChild(table);
  }

  _onSquareClick(square) {
    const piece = this.game.get(square);

    if (this.selectedSquare) {
      const from = this.selectedSquare;
      const to = square;

      // Same square = deselect
      if (from === to) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render();
        return;
      }

      // Check if this is a promotion move
      const movingPiece = this.game.get(from);
      if (movingPiece && movingPiece.type === 'p') {
        const targetRank = to[1];
        if ((movingPiece.color === 'w' && targetRank === '8') ||
            (movingPiece.color === 'b' && targetRank === '1')) {
          const legalPromotion = this.legalMoves.some(m => m.to === to);
          if (legalPromotion) {
            this._showPromotionDialog(from, to, movingPiece.color);
            return;
          }
        }
      }

      // Try to make the move
      const move = this._tryMove(from, to);
      if (move) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render();
        return;
      }

      // Clicked on own piece => select it instead
      if (piece && piece.color === this.game.turn()) {
        this.selectedSquare = square;
        this.legalMoves = this.game.moves({ square, verbose: true });
        this.render();
        return;
      }

      // Deselect
      this.selectedSquare = null;
      this.legalMoves = [];
      this.render();
      return;
    }

    // No selection — select a piece of the side to move
    if (piece && piece.color === this.game.turn()) {
      this.selectedSquare = square;
      this.legalMoves = this.game.moves({ square, verbose: true });
      this.render();
    }
  }

  _tryMove(from, to, promotion) {
    // Truncate future moves if browsing history
    if (this.currentMoveIndex < this.moveHistory.length - 1) {
      this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
    }

    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;

    try {
      const move = this.game.move(moveObj);
      if (move) {
        const uci = move.from + move.to + (move.promotion || '');
        this.moveHistory.push({
          fen: this.game.fen(),
          san: move.san,
          uci,
        });
        this.currentMoveIndex = this.moveHistory.length - 1;

        if (this.onMove) {
          this.onMove(move);
        }
        return move;
      }
    } catch {
      // Invalid move
    }
    return null;
  }

  _showPromotionDialog(from, to, color) {
    const overlay = document.createElement('div');
    overlay.className = 'promotion-overlay';

    const choices = document.createElement('div');
    choices.className = 'promotion-choices';

    for (const p of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('button');
      const span = document.createElement('span');
      span.className = 'piece piece-' + color;
      span.textContent = PIECE_CHARS[p];
      btn.appendChild(span);
      btn.addEventListener('click', () => {
        overlay.remove();
        this._tryMove(from, to, p);
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render();
      });
      choices.appendChild(btn);
    }

    overlay.appendChild(choices);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render();
      }
    });

    document.body.appendChild(overlay);
  }

  flip() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
  }

  undo() {
    const move = this.game.undo();
    if (move) {
      this.moveHistory.pop();
      this.currentMoveIndex = this.moveHistory.length - 1;
      this.selectedSquare = null;
      this.legalMoves = [];
      this.render();
      return move;
    }
    return null;
  }

  newGame() {
    this.game = new Chess();
    this.moveHistory = [];
    this.currentMoveIndex = -1;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.render();
  }

  fen() {
    return this.game.fen();
  }

  uciMoves() {
    return this.moveHistory.map(m => m.uci);
  }

  goToMove(index) {
    if (index < -1 || index >= this.moveHistory.length) return;

    if (index === -1) {
      this.game = new Chess();
    } else {
      this.game = new Chess(this.moveHistory[index].fen);
    }
    this.currentMoveIndex = index;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.render();
  }

  /**
   * Load a game from a PGN string, rebuilding move history.
   * @param {string} pgn
   */
  loadPGN(pgn) {
    const temp = new Chess();
    try {
      temp.loadPgn(pgn);
    } catch {
      throw new Error('Invalid PGN');
    }

    // Replay all moves to build history
    const history = temp.history({ verbose: true });
    const replay = new Chess();

    this.game = new Chess();
    this.moveHistory = [];
    this.currentMoveIndex = -1;
    this.selectedSquare = null;
    this.legalMoves = [];

    for (const move of history) {
      replay.move(move);
      const uci = move.from + move.to + (move.promotion || '');
      this.moveHistory.push({
        fen: replay.fen(),
        san: move.san,
        uci,
      });
    }

    // Jump to last position
    if (this.moveHistory.length > 0) {
      this.currentMoveIndex = this.moveHistory.length - 1;
      this.game = new Chess(this.moveHistory[this.currentMoveIndex].fen);
    }

    this.render();
  }

  gameStatus() {
    if (this.game.isCheckmate()) {
      return this.game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
    }
    if (this.game.isDraw()) {
      if (this.game.isStalemate()) return 'Draw by stalemate';
      if (this.game.isThreefoldRepetition()) return 'Draw by repetition';
      if (this.game.isInsufficientMaterial()) return 'Draw by insufficient material';
      return 'Draw by 50-move rule';
    }
    if (this.game.isCheck()) {
      return (this.game.turn() === 'w' ? 'White' : 'Black') + ' is in check';
    }
    return '';
  }
}

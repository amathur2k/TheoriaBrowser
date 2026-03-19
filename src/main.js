import { TheoriaEngine } from './engine/uci.js';
import { BoardUI } from './ui/board.js';
import { AnalysisPanel, formatScore } from './ui/analysis.js';
import { EvalBar } from './ui/evalbar.js';

// State
let engine = null;
let board = null;
let analysis = null;
let evalBar = null;
let analysisEnabled = false;
let maxDepth = 20;
let multiPV = 1;

async function main() {
  // Initialize UI components
  evalBar = new EvalBar();
  analysis = new AnalysisPanel();

  board = new BoardUI('chessboard', onMove);

  // Render initial move list
  renderMoveList();

  // Wire up controls
  setupControls();

  // Try to initialize engine (with 60s timeout for WASM load + NNUE)
  analysis.setStatus('loading...');
  try {
    engine = new TheoriaEngine();

    await Promise.race([
      engine.init((line) => {
        // Status callback during init
        if (line.startsWith('info string Worker:')) {
          analysis.setStatus(line.replace('info string Worker: ', ''));
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout (120s)')), 120000)),
    ]);
    analysis.setStatus('ready');
  } catch (err) {
    console.warn('Engine failed to load:', err.message);
    analysis.setStatus('not available (' + err.message + ')');
    engine = null;
  }
}

/**
 * Called when a move is made on the board.
 */
function onMove(move) {
  renderMoveList();

  if (analysisEnabled && engine) {
    runAnalysis();
  }
}

/**
 * Run engine analysis on the current position.
 */
async function runAnalysis() {
  if (!engine || !engine.ready) return;

  // Stop any ongoing analysis
  engine.stop();
  await engine.isReady();

  // Clear previous analysis
  analysis.clear();
  analysis.setPosition(board.fen());

  // Set position
  const moves = board.uciMoves();
  if (moves.length === 0) {
    engine.setPosition('startpos');
  } else {
    engine.setPosition('startpos', moves);
  }

  // Set MultiPV
  if (multiPV > 1) {
    await engine.setOption('MultiPV', multiPV);
  }

  // Start analysis
  engine.go({ depth: maxDepth }, (info) => {
    analysis.updateInfo(info);

    // Update eval bar with the first PV's score
    if (info.score && (!info.multipv || info.multipv === 1)) {
      const turn = board.game.turn();
      evalBar.update(info.score, turn);
    }
  });
}

/**
 * Render the move list below the board.
 */
function renderMoveList() {
  const moveListEl = document.getElementById('move-list');
  const moves = board.moveHistory;

  if (moves.length === 0) {
    moveListEl.innerHTML = '<span style="color:#666">No moves yet</span>';
    return;
  }

  let html = '';
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      const moveNum = Math.floor(i / 2) + 1;
      html += `<span class="move-number">${moveNum}.</span>`;
    }
    const isActive = i === board.currentMoveIndex;
    html += `<span class="move${isActive ? ' active' : ''}" data-index="${i}">${moves[i].san}</span>`;
  }

  moveListEl.innerHTML = html;

  // Click to navigate
  moveListEl.querySelectorAll('.move').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      board.goToMove(idx);
      renderMoveList();
      if (analysisEnabled && engine) {
        runAnalysis();
      }
    });
  });
}

/**
 * Set up control buttons and inputs.
 */
function setupControls() {
  // New Game
  document.getElementById('btn-new').addEventListener('click', () => {
    board.newGame();
    renderMoveList();
    analysis.clear();
    evalBar.reset();
    if (engine) {
      engine.stop();
    }
  });

  // Flip Board
  document.getElementById('btn-flip').addEventListener('click', () => {
    board.flip();
  });

  // Undo
  document.getElementById('btn-undo').addEventListener('click', () => {
    const move = board.undo();
    if (move) {
      renderMoveList();
      if (analysisEnabled && engine) {
        runAnalysis();
      }
    }
  });

  // Analysis toggle
  const btnAnalysis = document.getElementById('btn-analysis');
  btnAnalysis.addEventListener('click', () => {
    analysisEnabled = !analysisEnabled;
    btnAnalysis.textContent = `Analysis: ${analysisEnabled ? 'On' : 'Off'}`;
    btnAnalysis.classList.toggle('active', analysisEnabled);

    if (analysisEnabled && engine) {
      runAnalysis();
    } else if (engine) {
      engine.stop();
      analysis.clear();
    }
  });

  // Depth slider
  const depthSlider = document.getElementById('depth-slider');
  const depthValue = document.getElementById('depth-value');
  depthSlider.addEventListener('input', () => {
    maxDepth = parseInt(depthSlider.value);
    depthValue.textContent = maxDepth;
  });

  // MultiPV selector
  const mpvSelect = document.getElementById('multipv-select');
  mpvSelect.addEventListener('change', async () => {
    multiPV = parseInt(mpvSelect.value);
    if (engine && engine.ready) {
      await engine.setOption('MultiPV', multiPV);
      if (analysisEnabled) {
        runAnalysis();
      }
    }
  });
}

// Start the app
main();

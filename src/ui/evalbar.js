/**
 * Vertical evaluation bar (Lichess-style).
 * White advantage fills upward (light), black advantage fills downward (dark).
 */
export class EvalBar {
  constructor() {
    this.fill = document.getElementById('eval-bar-fill');
    this.label = document.getElementById('eval-bar-label');
    this.currentScore = null;
  }

  /**
   * Update the eval bar with a score object from UCI info.
   * @param {{ type: 'cp'|'mate', value: number }} score
   * @param {string} turn - 'w' or 'b' (whose turn it is)
   */
  update(score, turn) {
    if (!score) return;

    this.currentScore = score;
    let displayValue;
    let percentage;

    if (score.type === 'mate') {
      // Mate scores: pin to extreme
      const mateValue = score.value;
      // Positive = side to move has mate, negative = side to move is getting mated
      // Convert to white's perspective
      const whiteHasMate = (turn === 'w' && mateValue > 0) || (turn === 'b' && mateValue < 0);
      percentage = whiteHasMate ? 100 : 0;
      const absVal = Math.abs(mateValue);
      displayValue = (whiteHasMate ? '+' : '-') + 'M' + absVal;
    } else {
      // Centipawn score - convert to white's perspective
      let cp = score.value;
      if (turn === 'b') cp = -cp; // Negate if it's black's turn since UCI score is from side-to-move perspective

      // Sigmoid compression: maps cp to 0-100 percentage
      // Using a logistic curve centered at 0, with range capped visually
      percentage = sigmoid(cp);

      const pawns = cp / 100;
      displayValue = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
    }

    this._animate(percentage, displayValue);
  }

  /**
   * Reset the eval bar to neutral.
   */
  reset() {
    this.currentScore = null;
    this._animate(50, '0.0');
  }

  _animate(percentage, displayValue) {
    // The fill represents white's portion, growing from bottom
    // At 50% = equal, white fill covers bottom half
    if (percentage >= 50) {
      // White advantage: fill grows upward from the middle
      this.fill.style.bottom = '0%';
      this.fill.style.height = percentage + '%';
      this.fill.style.background = '#f0f0f0';
    } else {
      // Black advantage: white fill shrinks
      this.fill.style.bottom = '0%';
      this.fill.style.height = percentage + '%';
      this.fill.style.background = '#f0f0f0';
    }

    this.label.textContent = displayValue;
  }
}

/**
 * Sigmoid function mapping centipawns to 0-100 percentage.
 * Designed so ±10 pawns maps to roughly ±95%.
 */
function sigmoid(cp) {
  // k controls steepness. At k=0.004: ±250cp ≈ 63/37%, ±500cp ≈ 73/27%, ±1000cp ≈ 88/12%
  const k = 0.004;
  return 100 / (1 + Math.exp(-k * cp));
}

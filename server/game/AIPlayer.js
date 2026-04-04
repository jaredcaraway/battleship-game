'use strict';

const SHIP_SIZES = [5, 4, 3, 3, 2];

class AIPlayer {
  /**
   * @param {'easy'|'medium'|'hard'} difficulty
   */
  constructor(difficulty) {
    this.difficulty = difficulty;
    this.mode = 'hunt';       // 'hunt' | 'target'
    this.hitQueue = [];       // cells to try next in target mode (medium)
    this.hits = [];           // all hit cells recorded (not yet sunk)
    this.misses = [];         // all miss cells recorded
    this.sunkShipCells = [];  // cells that belong to already-sunk ships
    this.remainingShipSizes = [...SHIP_SIZES];
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Record the result of the last attack.
   * @param {number} row
   * @param {number} col
   * @param {'hit'|'miss'} result
   * @param {boolean} sunk  - true if the hit sank a ship
   */
  recordResult(row, col, result, sunk) {
    if (result === 'miss') {
      this.misses.push({ row, col });
    } else {
      // hit
      this.hits.push({ row, col });

      if (sunk) {
        this._markSunk(row, col);
        // Return to hunt mode for medium difficulty
        this.mode = 'hunt';
        this.hitQueue = [];
      } else {
        // Switch to target mode and enqueue adjacent cells
        if (this.difficulty === 'medium') {
          this.mode = 'target';
          this._enqueueAdjacent(row, col);
        }
      }
    }
  }

  /**
   * Get the AI's next move.
   * @param {Board} board - the opponent's board (used to check which cells have been fired)
   * @returns {{ row: number, col: number }}
   */
  getMove(board) {
    const fired = new Set(board.shots.map(s => `${s.row},${s.col}`));

    switch (this.difficulty) {
      case 'easy':
        return this._randomMove(fired);
      case 'medium':
        return this._targetMove(fired);
      case 'hard':
        return this._probabilityMove(fired);
      default:
        return this._randomMove(fired);
    }
  }

  // ---------------------------------------------------------------------------
  // Private move strategies
  // ---------------------------------------------------------------------------

  /**
   * Easy: pick a random unfired cell.
   * @param {Set<string>} fired
   * @returns {{ row: number, col: number }}
   */
  _randomMove(fired) {
    let row, col;
    do {
      row = Math.floor(Math.random() * 10);
      col = Math.floor(Math.random() * 10);
    } while (fired.has(`${row},${col}`));
    return { row, col };
  }

  /**
   * Medium: try adjacent cells of the most recent hit; fall back to random.
   * @param {Set<string>} fired
   * @returns {{ row: number, col: number }}
   */
  _targetMove(fired) {
    if (this.mode === 'target') {
      // Drain the hitQueue looking for an unfired adjacent cell
      while (this.hitQueue.length > 0) {
        const candidate = this.hitQueue.shift();
        const key = `${candidate.row},${candidate.col}`;
        if (!fired.has(key)) {
          return candidate;
        }
      }
      // Queue exhausted — fall through to random
      this.mode = 'hunt';
    }
    return this._randomMove(fired);
  }

  /**
   * Hard: probability density map.
   * For each remaining ship size, enumerate all valid placements (horizontal +
   * vertical) that don't overlap known misses or sunk cells.  Increment a
   * density counter for every unfired cell the placement would cover.
   * Then boost cells adjacent to unsunk hits by 3x.
   * Fire at the highest-density unfired cell.
   * @param {Set<string>} fired
   * @returns {{ row: number, col: number }}
   */
  _probabilityMove(fired) {
    // Build fast lookup sets
    const missSet = new Set(this.misses.map(c => `${c.row},${c.col}`));
    const sunkSet = new Set(this.sunkShipCells.map(c => `${c.row},${c.col}`));
    const hitSet = new Set(this.hits.map(c => `${c.row},${c.col}`));

    // Blocked = misses + sunk ship cells
    const blocked = new Set([...missSet, ...sunkSet]);

    // density[r][c] accumulates probability weight
    const density = Array.from({ length: 10 }, () => Array(10).fill(0));

    for (const size of this.remainingShipSizes) {
      // Horizontal placements
      for (let r = 0; r <= 9; r++) {
        for (let startC = 0; startC <= 10 - size; startC++) {
          // Check if this placement conflicts with any blocked cell
          let valid = true;
          for (let i = 0; i < size; i++) {
            if (blocked.has(`${r},${startC + i}`)) {
              valid = false;
              break;
            }
          }
          if (valid) {
            for (let i = 0; i < size; i++) {
              density[r][startC + i]++;
            }
          }
        }
      }

      // Vertical placements
      for (let startR = 0; startR <= 10 - size; startR++) {
        for (let c = 0; c <= 9; c++) {
          let valid = true;
          for (let i = 0; i < size; i++) {
            if (blocked.has(`${startR + i},${c}`)) {
              valid = false;
              break;
            }
          }
          if (valid) {
            for (let i = 0; i < size; i++) {
              density[startR + i][c]++;
            }
          }
        }
      }
    }

    // Boost cells adjacent to unsunk hits by 3x
    for (const { row, col } of this.hits) {
      // Only boost if this hit cell is not sunk
      if (!sunkSet.has(`${row},${col}`)) {
        const neighbors = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const n of neighbors) {
          if (n.row >= 0 && n.row <= 9 && n.col >= 0 && n.col <= 9) {
            density[n.row][n.col] *= 3;
          }
        }
      }
    }

    // Find the highest-density unfired cell
    let bestRow = -1;
    let bestCol = -1;
    let bestDensity = -1;

    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 9; c++) {
        if (!fired.has(`${r},${c}`) && density[r][c] > bestDensity) {
          bestDensity = density[r][c];
          bestRow = r;
          bestCol = c;
        }
      }
    }

    // Fallback if density map yields nothing (shouldn't happen normally)
    if (bestRow === -1) {
      return this._randomMove(fired);
    }

    return { row: bestRow, col: bestCol };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Enqueue the four adjacent cells of (row, col) for medium targeting.
   * Out-of-bounds neighbors are silently skipped.
   * @param {number} row
   * @param {number} col
   */
  _enqueueAdjacent(row, col) {
    const neighbors = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ];
    for (const n of neighbors) {
      if (n.row >= 0 && n.row <= 9 && n.col >= 0 && n.col <= 9) {
        // Avoid adding duplicates
        const alreadyQueued = this.hitQueue.some(q => q.row === n.row && q.col === n.col);
        if (!alreadyQueued) {
          this.hitQueue.push(n);
        }
      }
    }
  }

  /**
   * BFS from (lastRow, lastCol) through adjacent unsunk hit cells to find all
   * cells of the just-sunk ship.  Moves them from hits to sunkShipCells and
   * removes one matching size from remainingShipSizes.
   * @param {number} lastRow
   * @param {number} lastCol
   */
  _markSunk(lastRow, lastCol) {
    const hitSet = new Set(this.hits.map(c => `${c.row},${c.col}`));

    // BFS to find connected hit cells
    const visited = new Set();
    const queue = [{ row: lastRow, col: lastCol }];
    visited.add(`${lastRow},${lastCol}`);

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 },
      ];
      for (const n of neighbors) {
        const key = `${n.row},${n.col}`;
        if (!visited.has(key) && hitSet.has(key)) {
          visited.add(key);
          queue.push(n);
        }
      }
    }

    const sunkCells = [...visited].map(key => {
      const [r, c] = key.split(',').map(Number);
      return { row: r, col: c };
    });

    // Move sunk cells from hits to sunkShipCells
    const sunkKeys = new Set(visited);
    this.hits = this.hits.filter(c => !sunkKeys.has(`${c.row},${c.col}`));
    this.sunkShipCells.push(...sunkCells);

    // Remove one ship of matching size from remainingShipSizes
    const shipSize = sunkCells.length;
    const idx = this.remainingShipSizes.indexOf(shipSize);
    if (idx !== -1) {
      this.remainingShipSizes.splice(idx, 1);
    }
  }
}

module.exports = AIPlayer;

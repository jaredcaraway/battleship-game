'use strict';

const AIPlayer = require('../server/game/AIPlayer');
const Board = require('../server/game/Board');

// ---------------------------------------------------------------------------
// Helper: build a fired Set from a board's shots array
// ---------------------------------------------------------------------------
function firedSetFromBoard(board) {
  return new Set(board.shots.map(s => `${s.row},${s.col}`));
}

// ---------------------------------------------------------------------------
// Helper: fire every attack on a board (100 cells), recording into ai
// ---------------------------------------------------------------------------
function drainBoard(ai, board) {
  while (board.shots.length < 100) {
    const fired = firedSetFromBoard(board);
    const { row, col } = ai.getMove(board);
    const result = board.receiveAttack(row, col);
    ai.recordResult(row, col, result.hit ? 'hit' : 'miss', result.sunk);
  }
}

// ---------------------------------------------------------------------------
// EASY difficulty
// ---------------------------------------------------------------------------
describe('AIPlayer — easy difficulty', () => {
  test('returns a valid cell (0-9, 0-9)', () => {
    const ai = new AIPlayer('easy');
    const board = new Board();
    board.randomize();
    const fired = firedSetFromBoard(board);
    const move = ai.getMove(board);
    expect(move).toHaveProperty('row');
    expect(move).toHaveProperty('col');
    expect(move.row).toBeGreaterThanOrEqual(0);
    expect(move.row).toBeLessThanOrEqual(9);
    expect(move.col).toBeGreaterThanOrEqual(0);
    expect(move.col).toBeLessThanOrEqual(9);
  });

  test('never fires the same cell twice over 100 iterations', () => {
    const ai = new AIPlayer('easy');
    const board = new Board();
    board.randomize();
    drainBoard(ai, board);
    // All 100 cells fired: confirm no duplicates
    const keys = board.shots.map(s => `${s.row},${s.col}`);
    expect(new Set(keys).size).toBe(100);
  });

  test('returned cell is never already fired', () => {
    const ai = new AIPlayer('easy');
    const board = new Board();
    board.randomize();
    // Fire 50 moves and confirm each returned cell was not already fired
    for (let i = 0; i < 50; i++) {
      const fired = firedSetFromBoard(board);
      const { row, col } = ai.getMove(board);
      expect(fired.has(`${row},${col}`)).toBe(false);
      const result = board.receiveAttack(row, col);
      ai.recordResult(row, col, result.hit ? 'hit' : 'miss', result.sunk);
    }
  });
});

// ---------------------------------------------------------------------------
// MEDIUM difficulty
// ---------------------------------------------------------------------------
describe('AIPlayer — medium difficulty', () => {
  test('starts in hunt mode (mode = "hunt")', () => {
    const ai = new AIPlayer('medium');
    expect(ai.mode).toBe('hunt');
  });

  test('switches to target mode after a hit', () => {
    const ai = new AIPlayer('medium');
    const board = new Board();
    // Place a single known ship so we can hit it deliberately
    board.placeShip('destroyer', 0, 0, 2, 'horizontal'); // cells: (0,0) and (0,1)

    // Simulate a hit at (0,0)
    ai.recordResult(0, 0, 'hit', false);
    expect(ai.mode).toBe('target');
  });

  test('hunts adjacent cells after a hit', () => {
    const ai = new AIPlayer('medium');
    const board = new Board();
    // Place a destroyer at row=5, col=5 horizontal -> (5,5) and (5,6)
    board.placeShip('destroyer', 5, 5, 2, 'horizontal');

    // Record a hit at (5,5) — the AI should now target adjacent cells
    ai.recordResult(5, 5, 'hit', false);
    // Mark (5,5) as fired on the board so AI won't return it
    board.shots.push({ row: 5, col: 5, hit: true });

    const move = ai.getMove(board);
    // The adjacent cells of (5,5) are: (4,5), (6,5), (5,4), (5,6)
    const adjacentTo55 = [
      { row: 4, col: 5 }, { row: 6, col: 5 },
      { row: 5, col: 4 }, { row: 5, col: 6 },
    ];
    const isAdjacent = adjacentTo55.some(c => c.row === move.row && c.col === move.col);
    expect(isAdjacent).toBe(true);
  });

  test('returns to hunt mode after sinking a ship', () => {
    const ai = new AIPlayer('medium');
    const board = new Board();
    board.placeShip('destroyer', 0, 0, 2, 'horizontal'); // (0,0) and (0,1)

    // Hit first cell
    ai.recordResult(0, 0, 'hit', false);
    expect(ai.mode).toBe('target');

    // Hit and sink second cell
    ai.recordResult(0, 1, 'hit', true); // sunk=true
    expect(ai.mode).toBe('hunt');
  });

  test('never fires same cell twice over 100 iterations', () => {
    const ai = new AIPlayer('medium');
    const board = new Board();
    board.randomize();
    drainBoard(ai, board);
    const keys = board.shots.map(s => `${s.row},${s.col}`);
    expect(new Set(keys).size).toBe(100);
  });

  test('hitQueue is populated after a hit and cleared after sinking', () => {
    const ai = new AIPlayer('medium');

    // Record two hits building a ship, then sink it
    ai.recordResult(3, 3, 'hit', false);
    expect(ai.hitQueue.length).toBeGreaterThan(0);

    ai.recordResult(3, 4, 'hit', true); // sunk
    expect(ai.hitQueue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HARD difficulty
// ---------------------------------------------------------------------------
describe('AIPlayer — hard difficulty', () => {
  test('returns a valid cell (0-9, 0-9)', () => {
    const ai = new AIPlayer('hard');
    const board = new Board();
    board.randomize();
    const move = ai.getMove(board);
    expect(move.row).toBeGreaterThanOrEqual(0);
    expect(move.row).toBeLessThanOrEqual(9);
    expect(move.col).toBeGreaterThanOrEqual(0);
    expect(move.col).toBeLessThanOrEqual(9);
  });

  test('returned cell is never already fired', () => {
    const ai = new AIPlayer('hard');
    const board = new Board();
    board.randomize();
    for (let i = 0; i < 50; i++) {
      const fired = firedSetFromBoard(board);
      const { row, col } = ai.getMove(board);
      expect(fired.has(`${row},${col}`)).toBe(false);
      const result = board.receiveAttack(row, col);
      ai.recordResult(row, col, result.hit ? 'hit' : 'miss', result.sunk);
    }
  });

  test('never fires same cell twice over 100 iterations', () => {
    const ai = new AIPlayer('hard');
    const board = new Board();
    board.randomize();
    drainBoard(ai, board);
    const keys = board.shots.map(s => `${s.row},${s.col}`);
    expect(new Set(keys).size).toBe(100);
  });

  test('prefers high-probability cells when constrained to one area', () => {
    // Set up: all misses across the entire board EXCEPT for a 5-cell strip
    // on row=0 cols=0-4 and row=1 cols=0-4 (only a carrier (size=5) can fit there).
    // The probability density should concentrate on that area.
    const ai = new AIPlayer('hard');
    const board = new Board();

    // Place a carrier at row=0 cols=0-4 (we'll miss everything else by
    // marking shots manually to avoid placing other ships)
    board.placeShip('carrier', 0, 0, 5, 'horizontal'); // row=0, col=0..4

    // Record misses for every cell EXCEPT row=0 cols=0..4
    // (skip row=1 too so there's room for horizontal fits)
    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 9; c++) {
        if (r === 0 && c < 5) continue; // keep row=0, cols 0-4 open for carrier
        if (r === 1 && c < 5) continue; // keep row=1, cols 0-4 open for density
        board.shots.push({ row: r, col: c, hit: false });
        ai.misses.push({ row: r, col: c });
      }
    }
    // Only remaining ships in AI's tracking: [5,4,3,3,2]
    // But with misses everywhere except the two small strips, only the carrier (5)
    // can fit in row=0 cols=0-4 and partially in row=1.
    // Force remaining ships to just [5] to make the test deterministic:
    ai.remainingShipSizes = [5];

    const fired = firedSetFromBoard(board);
    const move = ai.getMove(board);

    // The move should be within the open area (row 0-1, cols 0-4)
    const inOpenArea = (move.row === 0 || move.row === 1) && move.col < 5;
    expect(inOpenArea).toBe(true);
  });

  test('boosts cells adjacent to unsunk hits', () => {
    // With a hit recorded at (5,5) and one remaining ship of size 2,
    // the AI should target cells adjacent to (5,5).
    const ai = new AIPlayer('hard');
    const board = new Board();
    board.placeShip('destroyer', 5, 5, 2, 'horizontal'); // (5,5) and (5,6)

    // Mark most of the board as missed except near (5,5)
    for (let r = 0; r <= 9; r++) {
      for (let c = 0; c <= 9; c++) {
        if (r === 5 && c >= 4 && c <= 7) continue; // leave area around hit open
        board.shots.push({ row: r, col: c, hit: false });
        ai.misses.push({ row: r, col: c });
      }
    }

    // Record hit at (5,5)
    ai.hits = [{ row: 5, col: 5 }];
    board.shots.push({ row: 5, col: 5, hit: true });
    ai.remainingShipSizes = [2];

    const fired = firedSetFromBoard(board);
    const move = ai.getMove(board);

    // Adjacent to (5,5): (5,4), (5,6) — only (5,4) and (5,6) are unfired in the open area
    const adjacentToHit = [
      { row: 5, col: 4 }, { row: 5, col: 6 },
    ];
    const isAdjacentToHit = adjacentToHit.some(c => c.row === move.row && c.col === move.col);
    expect(isAdjacentToHit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AIPlayer constructor / state
// ---------------------------------------------------------------------------
describe('AIPlayer constructor', () => {
  test('stores difficulty', () => {
    const ai = new AIPlayer('hard');
    expect(ai.difficulty).toBe('hard');
  });

  test('initializes mode to hunt', () => {
    const ai = new AIPlayer('medium');
    expect(ai.mode).toBe('hunt');
  });

  test('initializes hitQueue to empty array', () => {
    const ai = new AIPlayer('medium');
    expect(ai.hitQueue).toEqual([]);
  });

  test('initializes hits to empty array', () => {
    const ai = new AIPlayer('hard');
    expect(ai.hits).toEqual([]);
  });

  test('initializes misses to empty array', () => {
    const ai = new AIPlayer('hard');
    expect(ai.misses).toEqual([]);
  });

  test('initializes sunkShipCells to empty array', () => {
    const ai = new AIPlayer('hard');
    expect(ai.sunkShipCells).toEqual([]);
  });

  test('initializes remainingShipSizes to [5,4,3,3,2]', () => {
    const ai = new AIPlayer('easy');
    expect(ai.remainingShipSizes).toEqual([5, 4, 3, 3, 2]);
  });
});

// ---------------------------------------------------------------------------
// recordResult
// ---------------------------------------------------------------------------
describe('AIPlayer recordResult', () => {
  test('records a miss in misses array', () => {
    const ai = new AIPlayer('hard');
    ai.recordResult(3, 7, 'miss', false);
    expect(ai.misses).toContainEqual({ row: 3, col: 7 });
  });

  test('records a hit in hits array', () => {
    const ai = new AIPlayer('hard');
    ai.recordResult(2, 4, 'hit', false);
    expect(ai.hits).toContainEqual({ row: 2, col: 4 });
  });

  test('removes ship size from remainingShipSizes when sunk', () => {
    const ai = new AIPlayer('hard');
    // Simulate sinking a destroyer (size 2) by hitting both cells
    ai.recordResult(0, 0, 'hit', false);
    ai.recordResult(0, 1, 'hit', true); // sunk
    // One size-2 ship should be removed from remaining
    const initialCount = [5, 4, 3, 3, 2].filter(s => s === 2).length; // 1
    const remainingCount = ai.remainingShipSizes.filter(s => s === 2).length;
    expect(remainingCount).toBe(initialCount - 1);
  });

  test('moves sunk cells to sunkShipCells', () => {
    const ai = new AIPlayer('hard');
    ai.recordResult(0, 0, 'hit', false);
    ai.recordResult(0, 1, 'hit', true); // sunk
    // Both hit cells should move to sunkShipCells
    expect(ai.sunkShipCells.some(c => c.row === 0 && c.col === 0)).toBe(true);
    expect(ai.sunkShipCells.some(c => c.row === 0 && c.col === 1)).toBe(true);
  });
});

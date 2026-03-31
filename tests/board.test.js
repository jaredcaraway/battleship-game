'use strict';

const Board = require('../server/game/Board');

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe('Board constructor', () => {
  let board;
  beforeEach(() => { board = new Board(); });

  test('creates a 10x10 grid filled with nulls', () => {
    expect(board.grid).toHaveLength(10);
    board.grid.forEach(row => {
      expect(row).toHaveLength(10);
      row.forEach(cell => expect(cell).toBeNull());
    });
  });

  test('starts with an empty ships array', () => {
    expect(board.ships).toEqual([]);
  });

  test('starts with an empty shots array', () => {
    expect(board.shots).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FLEET constant
// ---------------------------------------------------------------------------
describe('Board.FLEET constant', () => {
  test('defines the standard 5-ship fleet', () => {
    expect(Board.FLEET).toEqual({
      carrier: 5,
      battleship: 4,
      cruiser: 3,
      submarine: 3,
      destroyer: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// placeShip
// ---------------------------------------------------------------------------
describe('placeShip', () => {
  let board;
  beforeEach(() => { board = new Board(); });

  test('places a horizontal ship and writes ship name to grid cells', () => {
    board.placeShip('destroyer', 2, 3, 2, 'horizontal');
    // col=2, row=3, size=2, horizontal => grid[3][2] and grid[3][3] = 'destroyer'
    expect(board.grid[3][2]).toBe('destroyer');
    expect(board.grid[3][3]).toBe('destroyer');
  });

  test('places a vertical ship and writes ship name to grid cells', () => {
    board.placeShip('submarine', 5, 1, 3, 'vertical');
    // col=5, row=1, size=3, vertical => grid[1][5], grid[2][5], grid[3][5]
    expect(board.grid[1][5]).toBe('submarine');
    expect(board.grid[2][5]).toBe('submarine');
    expect(board.grid[3][5]).toBe('submarine');
  });

  test('adds a ship entry to board.ships with correct cells and zero hits', () => {
    board.placeShip('destroyer', 0, 0, 2, 'horizontal');
    expect(board.ships).toHaveLength(1);
    const ship = board.ships[0];
    expect(ship.name).toBe('destroyer');
    expect(ship.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(ship.hits).toBe(0);
    expect(ship.size).toBe(2);
  });

  test('throws (or returns falsy) when placement is out of bounds horizontally', () => {
    expect(() => board.placeShip('carrier', 8, 0, 5, 'horizontal')).toThrow();
  });

  test('throws (or returns falsy) when placement is out of bounds vertically', () => {
    expect(() => board.placeShip('carrier', 0, 8, 5, 'vertical')).toThrow();
  });

  test('throws when col is negative', () => {
    expect(() => board.placeShip('destroyer', -1, 0, 2, 'horizontal')).toThrow();
  });

  test('throws when row is negative', () => {
    expect(() => board.placeShip('destroyer', 0, -1, 2, 'horizontal')).toThrow();
  });

  test('throws on overlap with an existing ship', () => {
    board.placeShip('destroyer', 0, 0, 2, 'horizontal');
    expect(() => board.placeShip('submarine', 1, 0, 3, 'horizontal')).toThrow();
  });

  test('allows adjacent (non-overlapping) ships', () => {
    board.placeShip('destroyer', 0, 0, 2, 'horizontal');
    expect(() => board.placeShip('submarine', 0, 1, 3, 'horizontal')).not.toThrow();
  });

  test('tracks cells correctly for a vertical placement', () => {
    board.placeShip('battleship', 4, 2, 4, 'vertical');
    const ship = board.ships[0];
    expect(ship.cells).toEqual([
      { row: 2, col: 4 },
      { row: 3, col: 4 },
      { row: 4, col: 4 },
      { row: 5, col: 4 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// receiveAttack
// ---------------------------------------------------------------------------
describe('receiveAttack', () => {
  let board;
  beforeEach(() => {
    board = new Board();
    // carrier horizontal at col=0, row=0, size=5
    board.placeShip('carrier', 0, 0, 5, 'horizontal');
    // destroyer vertical at col=9, row=0, size=2
    board.placeShip('destroyer', 9, 0, 2, 'vertical');
  });

  test('returns { hit: true } on a hit', () => {
    const result = board.receiveAttack(0, 0);
    expect(result.hit).toBe(true);
  });

  test('returns { hit: false } on a miss', () => {
    const result = board.receiveAttack(5, 5);
    expect(result.hit).toBe(false);
  });

  test('increments ship hits on a hit', () => {
    board.receiveAttack(0, 0);
    expect(board.ships[0].hits).toBe(1);
  });

  test('records shots for hits', () => {
    board.receiveAttack(0, 2);
    expect(board.shots).toContainEqual({ row: 0, col: 2, hit: true });
  });

  test('records shots for misses', () => {
    board.receiveAttack(5, 5);
    expect(board.shots).toContainEqual({ row: 5, col: 5, hit: false });
  });

  test('returns { sunk: true } when a ship is fully hit', () => {
    // Sink the 2-cell destroyer at col=9, row=0 and row=1
    board.receiveAttack(0, 9);
    const result = board.receiveAttack(1, 9);
    expect(result.sunk).toBe(true);
    expect(result.sunkShip).toBe('destroyer');
  });

  test('returns { sunk: false } when ship is hit but not yet sunk', () => {
    const result = board.receiveAttack(0, 0); // first hit on carrier (size 5)
    expect(result.sunk).toBe(false);
  });

  test('throws on duplicate attack', () => {
    board.receiveAttack(0, 0);
    expect(() => board.receiveAttack(0, 0)).toThrow();
  });

  test('throws on out-of-bounds attack (row)', () => {
    expect(() => board.receiveAttack(10, 0)).toThrow();
  });

  test('throws on out-of-bounds attack (col)', () => {
    expect(() => board.receiveAttack(0, 10)).toThrow();
  });

  test('throws on negative attack coordinates', () => {
    expect(() => board.receiveAttack(-1, 0)).toThrow();
    expect(() => board.receiveAttack(0, -1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// allShipsSunk
// ---------------------------------------------------------------------------
describe('allShipsSunk', () => {
  let board;
  beforeEach(() => {
    board = new Board();
    board.placeShip('destroyer', 0, 0, 2, 'horizontal');
  });

  test('returns false when ships remain unsunk', () => {
    expect(board.allShipsSunk()).toBe(false);
  });

  test('returns false after a partial hit', () => {
    board.receiveAttack(0, 0);
    expect(board.allShipsSunk()).toBe(false);
  });

  test('returns true when all ships are sunk', () => {
    board.receiveAttack(0, 0);
    board.receiveAttack(0, 1);
    expect(board.allShipsSunk()).toBe(true);
  });

  test('returns false with no ships placed', () => {
    const emptyBoard = new Board();
    expect(emptyBoard.allShipsSunk()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getState
// ---------------------------------------------------------------------------
describe('getState', () => {
  let board;
  beforeEach(() => {
    board = new Board();
    board.placeShip('destroyer', 0, 0, 2, 'horizontal');
    board.receiveAttack(0, 0); // hit
    board.receiveAttack(5, 5); // miss
  });

  test('owner view (hidden=false) includes ship positions in grid', () => {
    const state = board.getState(false);
    // Cell (row=0, col=0) was a hit, cell (row=0, col=1) is untouched ship
    expect(state.grid[0][1]).toBe('destroyer');
  });

  test('owner view includes ships array', () => {
    const state = board.getState(false);
    expect(state.ships).toBeDefined();
    expect(state.ships).toHaveLength(1);
  });

  test('opponent view (hidden=true) hides unfound ship cells (returns null)', () => {
    const state = board.getState(true);
    // col=1, row=0 is an un-hit destroyer cell — should be null in opponent view
    expect(state.grid[0][1]).toBeNull();
  });

  test('opponent view shows hit cells', () => {
    const state = board.getState(true);
    // row=0, col=0 was hit
    expect(state.grid[0][0]).not.toBeNull();
  });

  test('opponent view shows miss cells', () => {
    const state = board.getState(true);
    // row=5, col=5 was missed — should show something (e.g. 'miss')
    expect(state.grid[5][5]).not.toBeNull();
  });

  test('getState returns a grid with 10 rows', () => {
    const state = board.getState(false);
    expect(state.grid).toHaveLength(10);
  });

  test('getState does not mutate the internal grid', () => {
    const state = board.getState(true);
    // Mutating returned state grid should not affect board.grid
    state.grid[0][1] = 'mutated';
    expect(board.grid[0][1]).toBe('destroyer');
  });
});

// ---------------------------------------------------------------------------
// placeAllShips
// ---------------------------------------------------------------------------
describe('placeAllShips', () => {
  const validFleet = [
    { name: 'carrier',    col: 0, row: 0, size: 5, orientation: 'horizontal' },
    { name: 'battleship', col: 0, row: 1, size: 4, orientation: 'horizontal' },
    { name: 'cruiser',    col: 0, row: 2, size: 3, orientation: 'horizontal' },
    { name: 'submarine',  col: 0, row: 3, size: 3, orientation: 'horizontal' },
    { name: 'destroyer',  col: 0, row: 4, size: 2, orientation: 'horizontal' },
  ];

  test('places all 5 standard ships successfully', () => {
    const board = new Board();
    board.placeAllShips(validFleet);
    expect(board.ships).toHaveLength(5);
  });

  test('throws when fewer than 5 ships are provided', () => {
    const board = new Board();
    expect(() => board.placeAllShips(validFleet.slice(0, 4))).toThrow();
  });

  test('throws when more than 5 ships are provided', () => {
    const board = new Board();
    const extra = [...validFleet, { name: 'carrier', col: 5, row: 5, size: 5, orientation: 'horizontal' }];
    expect(() => board.placeAllShips(extra)).toThrow();
  });

  test('throws when a ship has the wrong name', () => {
    const board = new Board();
    const wrongName = validFleet.map((s, i) => i === 0 ? { ...s, name: 'supercarrier' } : s);
    expect(() => board.placeAllShips(wrongName)).toThrow();
  });

  test('throws when a ship has the wrong size for its name', () => {
    const board = new Board();
    const wrongSize = validFleet.map((s, i) => i === 0 ? { ...s, size: 3 } : s);
    expect(() => board.placeAllShips(wrongSize)).toThrow();
  });

  test('does not allow duplicate ship names', () => {
    const board = new Board();
    const dup = [
      { name: 'carrier',    col: 0, row: 0, size: 5, orientation: 'horizontal' },
      { name: 'carrier',    col: 0, row: 1, size: 5, orientation: 'horizontal' },
      { name: 'cruiser',    col: 0, row: 2, size: 3, orientation: 'horizontal' },
      { name: 'submarine',  col: 0, row: 3, size: 3, orientation: 'horizontal' },
      { name: 'destroyer',  col: 0, row: 4, size: 2, orientation: 'horizontal' },
    ];
    expect(() => board.placeAllShips(dup)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// randomize
// ---------------------------------------------------------------------------
describe('randomize', () => {
  test('places exactly 5 ships', () => {
    const board = new Board();
    board.randomize();
    expect(board.ships).toHaveLength(5);
  });

  test('places all ships from the standard fleet', () => {
    const board = new Board();
    board.randomize();
    const names = board.ships.map(s => s.name).sort();
    expect(names).toEqual(['battleship', 'carrier', 'cruiser', 'destroyer', 'submarine']);
  });

  test('no ships overlap after randomize', () => {
    const board = new Board();
    board.randomize();
    const occupied = new Set();
    for (const ship of board.ships) {
      for (const { row, col } of ship.cells) {
        const key = `${row},${col}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
  });

  test('all ship cells are within 0-9 bounds', () => {
    const board = new Board();
    board.randomize();
    for (const ship of board.ships) {
      for (const { row, col } of ship.cells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThanOrEqual(9);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThanOrEqual(9);
      }
    }
  });

  test('produces different placements across multiple runs (probabilistic)', () => {
    const placements = new Set();
    for (let i = 0; i < 10; i++) {
      const b = new Board();
      b.randomize();
      placements.add(JSON.stringify(b.ships.map(s => s.cells)));
    }
    // With 10 random runs, we almost certainly get at least 2 distinct layouts
    expect(placements.size).toBeGreaterThan(1);
  });
});

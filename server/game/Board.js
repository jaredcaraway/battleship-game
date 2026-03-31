'use strict';

// Standard Battleship fleet: name -> size
const FLEET = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

class Board {
  constructor() {
    // 10x10 grid of nulls — grid[row][col]
    this.grid = Array.from({ length: 10 }, () => Array(10).fill(null));
    this.ships = [];  // [{ name, size, cells: [{row, col}], hits }]
    this.shots = [];  // [{ row, col, hit }]
  }

  // -------------------------------------------------------------------------
  // placeShip(name, col, row, size, orientation)
  //   orientation: 'horizontal' | 'vertical'
  //   Horizontal: occupies (row, col), (row, col+1), ..., (row, col+size-1)
  //   Vertical:   occupies (row, col), (row+1, col), ..., (row+size-1, col)
  // -------------------------------------------------------------------------
  placeShip(name, col, row, size, orientation) {
    if (row < 0 || col < 0) {
      throw new Error(`Invalid placement: row and col must be >= 0 (got row=${row}, col=${col})`);
    }

    // Build the list of cells this ship will occupy
    const cells = [];
    for (let i = 0; i < size; i++) {
      const r = orientation === 'vertical' ? row + i : row;
      const c = orientation === 'horizontal' ? col + i : col;

      if (r < 0 || r > 9 || c < 0 || c > 9) {
        throw new Error(
          `Ship "${name}" placement out of bounds at (row=${r}, col=${c}) with orientation=${orientation}`
        );
      }
      if (this.grid[r][c] !== null) {
        throw new Error(
          `Ship "${name}" overlaps with existing ship at (row=${r}, col=${c})`
        );
      }
      cells.push({ row: r, col: c });
    }

    // Write ship name into grid and record ship
    cells.forEach(({ row: r, col: c }) => {
      this.grid[r][c] = name;
    });

    this.ships.push({ name, size, cells, hits: 0 });
  }

  // -------------------------------------------------------------------------
  // placeAllShips(shipDefs)
  //   shipDefs: [{ name, col, row, size, orientation }]
  //   Validates the fleet is exactly the 5 standard ships with correct sizes.
  // -------------------------------------------------------------------------
  placeAllShips(shipDefs) {
    if (!Array.isArray(shipDefs) || shipDefs.length !== 5) {
      throw new Error(`placeAllShips requires exactly 5 ships, got ${shipDefs ? shipDefs.length : 0}`);
    }

    // Validate each ship name and size against the FLEET constant
    const seenNames = new Set();
    for (const def of shipDefs) {
      if (!(def.name in FLEET)) {
        throw new Error(`Unknown ship name "${def.name}". Valid names: ${Object.keys(FLEET).join(', ')}`);
      }
      if (seenNames.has(def.name)) {
        throw new Error(`Duplicate ship name "${def.name}" in fleet definition`);
      }
      seenNames.add(def.name);

      if (def.size !== FLEET[def.name]) {
        throw new Error(
          `Ship "${def.name}" has wrong size ${def.size}; expected ${FLEET[def.name]}`
        );
      }
    }

    // All names must be present (exactly the 5 fleet ships)
    for (const name of Object.keys(FLEET)) {
      if (!seenNames.has(name)) {
        throw new Error(`Missing required ship "${name}" in fleet definition`);
      }
    }

    // Place each ship
    for (const def of shipDefs) {
      this.placeShip(def.name, def.col, def.row, def.size, def.orientation);
    }
  }

  // -------------------------------------------------------------------------
  // randomize()
  //   Randomly places all 5 standard ships on a fresh grid.
  //   Retries until a valid non-overlapping placement is found.
  // -------------------------------------------------------------------------
  randomize() {
    const names = Object.keys(FLEET);

    let success = false;
    while (!success) {
      // Reset state for each retry
      this.grid = Array.from({ length: 10 }, () => Array(10).fill(null));
      this.ships = [];

      success = true;
      for (const name of names) {
        const size = FLEET[name];
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 200) {
          attempts++;
          const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
          const maxCol = orientation === 'horizontal' ? 10 - size : 9;
          const maxRow = orientation === 'vertical' ? 10 - size : 9;
          const col = Math.floor(Math.random() * (maxCol + 1));
          const row = Math.floor(Math.random() * (maxRow + 1));

          try {
            this.placeShip(name, col, row, size, orientation);
            placed = true;
          } catch (e) {
            // overlap or out-of-bounds, retry
          }
        }

        if (!placed) {
          // Failed to place this ship; restart the whole board
          success = false;
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // receiveAttack(row, col)
  //   Returns { hit, sunk, sunkShip }
  // -------------------------------------------------------------------------
  receiveAttack(row, col) {
    if (row < 0 || row > 9 || col < 0 || col > 9) {
      throw new Error(`Attack out of bounds: (row=${row}, col=${col})`);
    }

    const alreadyShot = this.shots.some(s => s.row === row && s.col === col);
    if (alreadyShot) {
      throw new Error(`Duplicate attack at (row=${row}, col=${col})`);
    }

    const cellValue = this.grid[row][col];
    const hit = cellValue !== null;

    let sunk = false;
    let sunkShip = null;

    if (hit) {
      const ship = this.ships.find(s => s.name === cellValue);
      ship.hits += 1;
      if (ship.hits === ship.size) {
        sunk = true;
        sunkShip = ship.name;
      }
    }

    this.shots.push({ row, col, hit });
    return { hit, sunk, sunkShip };
  }

  // -------------------------------------------------------------------------
  // allShipsSunk()
  //   Returns true only if every ship has been fully hit AND there is at least
  //   one ship on the board.
  // -------------------------------------------------------------------------
  allShipsSunk() {
    if (this.ships.length === 0) return false;
    return this.ships.every(s => s.hits === s.size);
  }

  // -------------------------------------------------------------------------
  // getState(hidden)
  //   hidden=false (owner view): shows ship names in grid cells
  //   hidden=true  (opponent view): hides un-hit ship cells (shows null)
  //
  //   Hit cells show the ship name; miss cells show 'miss'.
  //   Returns { grid, ships } — grid is a deep copy.
  // -------------------------------------------------------------------------
  getState(hidden) {
    const hitCells = new Set(
      this.shots.filter(s => s.hit).map(s => `${s.row},${s.col}`)
    );
    const missCells = new Set(
      this.shots.filter(s => !s.hit).map(s => `${s.row},${s.col}`)
    );

    const grid = this.grid.map((rowArr, r) =>
      rowArr.map((cell, c) => {
        const key = `${r},${c}`;
        if (missCells.has(key)) return 'miss';
        if (hitCells.has(key)) return cell;  // ship name on a hit cell
        if (hidden && cell !== null) return null; // hide un-hit ship positions
        return cell;
      })
    );

    return { grid, ships: this.ships };
  }
}

// Attach FLEET as a static property so consumers can reference Board.FLEET
Board.FLEET = FLEET;

module.exports = Board;

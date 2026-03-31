'use strict';

const GameRoom = require('../server/game/GameRoom');

// Standard fleet used across tests
const ships = [
  { name: 'carrier',    col: 0, row: 0, size: 5, orientation: 'horizontal' },
  { name: 'battleship', col: 0, row: 1, size: 4, orientation: 'horizontal' },
  { name: 'cruiser',    col: 0, row: 2, size: 3, orientation: 'horizontal' },
  { name: 'submarine',  col: 0, row: 3, size: 3, orientation: 'horizontal' },
  { name: 'destroyer',  col: 0, row: 4, size: 2, orientation: 'horizontal' },
];

// Helper: fire all shots needed to sink all ships on a specific player's board
// Ships are placed at rows 0-4 with horizontal orientation
function sinkAllShips(room, firingSocketId, targetSocketId) {
  // carrier: row 0, cols 0-4
  room.fire(firingSocketId, 0, 0);
  room.fire(firingSocketId, 0, 1);
  room.fire(firingSocketId, 0, 2);
  room.fire(firingSocketId, 0, 3);
  room.fire(firingSocketId, 0, 4);
  // battleship: row 1, cols 0-3
  room.fire(firingSocketId, 1, 0);
  room.fire(firingSocketId, 1, 1);
  room.fire(firingSocketId, 1, 2);
  room.fire(firingSocketId, 1, 3);
  // cruiser: row 2, cols 0-2
  room.fire(firingSocketId, 2, 0);
  room.fire(firingSocketId, 2, 1);
  room.fire(firingSocketId, 2, 2);
  // submarine: row 3, cols 0-2
  room.fire(firingSocketId, 3, 0);
  room.fire(firingSocketId, 3, 1);
  room.fire(firingSocketId, 3, 2);
  // destroyer: row 4, cols 0-1
  room.fire(firingSocketId, 4, 0);
  return room.fire(firingSocketId, 4, 1);
}

// ============================================================================
// Two-player game tests
// ============================================================================

describe('GameRoom — two-player game', () => {
  let room;

  beforeEach(() => {
    room = new GameRoom('room-1', 'pvp');
  });

  test('creates room with correct id, mode, and phase=setup', () => {
    expect(room.id).toBe('room-1');
    expect(room.mode).toBe('pvp');
    expect(room.phase).toBe('setup');
  });

  test('adds two players with socketIds and userIds', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');

    expect(room.players).toHaveLength(2);
    expect(room.players[0]).toMatchObject({ socketId: 'socket-1', userId: 'user-1', isAI: false, ready: false });
    expect(room.players[1]).toMatchObject({ socketId: 'socket-2', userId: 'user-2', isAI: false, ready: false });
    expect(room.boards['socket-1']).toBeDefined();
    expect(room.boards['socket-2']).toBeDefined();
  });

  test('rejects a third player with error code room_full', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');

    expect(() => room.addPlayer('socket-3', 'user-3')).toThrow(/room_full/i);
  });

  test('accepts ship placement, transitions to playing when both ready', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');

    room.placeShips('socket-1', ships);
    expect(room.phase).toBe('setup'); // still setup — player 2 not ready
    expect(room.players[0].ready).toBe(true);

    room.placeShips('socket-2', ships);
    expect(room.phase).toBe('playing');
    expect(room.currentTurn).toBe('socket-1');
  });

  test('alternates turns starting with player 1', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);

    expect(room.currentTurn).toBe('socket-1');

    room.fire('socket-1', 5, 5); // miss (ships are in rows 0-4)
    expect(room.currentTurn).toBe('socket-2');

    room.fire('socket-2', 5, 6);
    expect(room.currentTurn).toBe('socket-1');
  });

  test('rejects fire from wrong player with error code not_your_turn', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);

    // socket-2 tries to fire before their turn
    expect(() => room.fire('socket-2', 0, 0)).toThrow(/not_your_turn/i);
  });

  test('detects game over when all ships sunk and sets winner', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);

    // socket-1 sinks all of socket-2's ships
    // We need to alternate turns so we have to use the helper differently for pvp
    // Manually alternate: socket-1 fires, socket-2 fires a miss, repeat
    const targetRow = [0, 1, 2, 3, 4];
    const targetCols = [[0,1,2,3,4],[0,1,2,3],[0,1,2],[0,1,2],[0,1]];

    let result;
    for (let r = 0; r < targetRow.length; r++) {
      for (let c = 0; c < targetCols[r].length; c++) {
        result = room.fire('socket-1', targetRow[r], targetCols[r][c]);
        if (room.phase !== 'finished') {
          // socket-2 fires a miss in a safe area (rows 5-9, won't hit ships in rows 0-4)
          room.fire('socket-2', 5 + r, c);
        }
      }
    }

    expect(room.phase).toBe('finished');
    expect(room.winner).toBe('socket-1');
    expect(result.gameOver).toBe(true);
  });

  test('rejects fire when phase is not playing', () => {
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    // Don't place ships — phase is still 'setup'
    expect(() => room.fire('socket-1', 0, 0)).toThrow(/not_playing/i);
  });
});

// ============================================================================
// AI game tests
// ============================================================================

describe('GameRoom — AI game', () => {
  let room;

  beforeEach(() => {
    room = new GameRoom('room-ai', 'ai_medium');
  });

  test('creates AI game with single human player and AI via setupAI()', () => {
    room.addPlayer('socket-1', 'user-1');
    room.setupAI();

    expect(room.players).toHaveLength(2);
    const aiPlayer = room.players.find(p => p.isAI);
    expect(aiPlayer).toBeDefined();
    expect(aiPlayer.ready).toBe(true);
  });

  test('AI places ships automatically (board is randomized)', () => {
    room.addPlayer('socket-1', 'user-1');
    room.setupAI();

    const aiPlayer = room.players.find(p => p.isAI);
    const aiBoard = room.boards[aiPlayer.socketId];
    expect(aiBoard.ships).toHaveLength(5);
  });

  test('AI fires back after player fires; result includes aiMove; turn stays with human', () => {
    room.addPlayer('socket-1', 'user-1');
    room.setupAI();

    // Human places ships — AI is already ready, this should transition to playing
    room.placeShips('socket-1', ships);
    expect(room.phase).toBe('playing');
    expect(room.currentTurn).toBe('socket-1');

    // Human fires
    const result = room.fire('socket-1', 9, 9); // unlikely to hit an AI ship

    // AI should have fired back
    expect(result.aiMove).toBeDefined();
    expect(result.aiMove).toHaveProperty('row');
    expect(result.aiMove).toHaveProperty('col');

    // Turn should remain with the human player
    expect(room.currentTurn).toBe('socket-1');
  });

  test('AI difficulty maps from mode string (ai_medium -> medium)', () => {
    room.addPlayer('socket-1', 'user-1');
    room.setupAI();

    expect(room.ai).toBeDefined();
    expect(room.ai.difficulty).toBe('medium');
  });
});

// ============================================================================
// getState tests
// ============================================================================

describe('GameRoom — getState', () => {
  let room;

  beforeEach(() => {
    room = new GameRoom('room-state', 'pvp');
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);
  });

  test('returns state scoped to requesting player', () => {
    const state = room.getState('socket-1');

    expect(state).toHaveProperty('roomId', 'room-state');
    expect(state).toHaveProperty('mode', 'pvp');
    expect(state).toHaveProperty('phase', 'playing');
    expect(state).toHaveProperty('currentTurn');
    expect(state).toHaveProperty('turnCount');
    expect(state).toHaveProperty('myBoard');
    expect(state).toHaveProperty('enemyBoard');
    expect(state).toHaveProperty('winner');
  });

  test('myBoard shows own ships (hidden=false)', () => {
    const state = room.getState('socket-1');
    // Own ships placed at row 0, so grid[0] should have carrier cells visible
    const myGrid = state.myBoard.grid;
    expect(myGrid[0][0]).toBe('carrier');
  });

  test('enemyBoard hides un-hit ships (hidden=true)', () => {
    const state = room.getState('socket-1');
    // Enemy ships in row 0 should be hidden (null) before any shots
    const enemyGrid = state.enemyBoard.grid;
    expect(enemyGrid[0][0]).toBeNull();
  });

  test('enemyBoard reveals hit cells after firing', () => {
    room.fire('socket-1', 0, 0); // hits carrier of socket-2 at row 0, col 0

    const state = room.getState('socket-1');
    expect(state.enemyBoard.grid[0][0]).toBe('carrier');
  });
});

// ============================================================================
// getStats tests
// ============================================================================

describe('GameRoom — getStats', () => {
  test('returns stats object with expected keys', () => {
    const room = new GameRoom('room-stats', 'pvp');
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);

    const stats = room.getStats();

    expect(stats).toHaveProperty('player1_id');
    expect(stats).toHaveProperty('player2_id');
    expect(stats).toHaveProperty('mode');
    expect(stats).toHaveProperty('winner_id');
    expect(stats).toHaveProperty('turns');
    expect(stats).toHaveProperty('player1_accuracy');
    expect(stats).toHaveProperty('player2_accuracy');
    expect(stats).toHaveProperty('duration_seconds');
  });
});

// ============================================================================
// reconnect tests
// ============================================================================

describe('GameRoom — reconnect', () => {
  test('moves board reference and updates player socketId', () => {
    const room = new GameRoom('room-reconnect', 'pvp');
    room.addPlayer('socket-old', 'user-1');

    room.reconnect('socket-old', 'socket-new');

    const player = room.players.find(p => p.socketId === 'socket-new');
    expect(player).toBeDefined();
    expect(room.boards['socket-new']).toBeDefined();
    expect(room.boards['socket-old']).toBeUndefined();
  });

  test('reconnect updates currentTurn when reconnecting active player', () => {
    const room = new GameRoom('room-reconnect2', 'pvp');
    room.addPlayer('socket-1', 'user-1');
    room.addPlayer('socket-2', 'user-2');
    room.placeShips('socket-1', ships);
    room.placeShips('socket-2', ships);

    expect(room.currentTurn).toBe('socket-1');

    room.reconnect('socket-1', 'socket-1-new');
    expect(room.currentTurn).toBe('socket-1-new');
    expect(room.boards['socket-1-new']).toBeDefined();
    expect(room.boards['socket-1']).toBeUndefined();
  });
});

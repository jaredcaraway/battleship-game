'use strict';

const Board = require('./Board');
const AIPlayer = require('./AIPlayer');

class GameRoom {
  /**
   * @param {string} id   - unique room identifier
   * @param {string} mode - 'pvp' | 'ai_easy' | 'ai_medium' | 'ai_hard'
   */
  constructor(id, mode) {
    this.id = id;
    this.mode = mode;

    this.players = [];      // [{ socketId, userId, isAI, ready }]
    this.boards = {};       // { [socketId]: Board }

    this.phase = 'setup';   // 'setup' | 'playing' | 'finished'
    this.currentTurn = null;
    this.turnCount = 0;

    this.startedAt = null;
    this.endedAt = null;
    this.winner = null;     // socketId of winner, or null

    this.ai = null;         // AIPlayer instance (for AI games)

    // Track shots-fired per player for accuracy stats
    // { [socketId]: { fired: number, hits: number } }
    this._stats = {};
  }

  // ---------------------------------------------------------------------------
  // addPlayer(socketId, userId)
  //   Adds a human player to the room. Throws if room is already full (2 players).
  // ---------------------------------------------------------------------------
  addPlayer(socketId, userId) {
    if (this.players.length >= 2) {
      throw new Error('room_full: This room already has 2 players');
    }

    this.players.push({ socketId, userId, isAI: false, ready: false });
    this.boards[socketId] = new Board();
    this._stats[socketId] = { fired: 0, hits: 0 };
  }

  // ---------------------------------------------------------------------------
  // setupAI()
  //   Creates an AIPlayer using the difficulty extracted from the mode string
  //   (e.g. 'ai_medium' → 'medium'), adds it as a second player, randomizes its
  //   board, and marks it ready.
  // ---------------------------------------------------------------------------
  setupAI() {
    // Extract difficulty from mode string: 'ai_medium' → 'medium'
    const parts = this.mode.split('_');
    const difficulty = parts.length > 1 ? parts[1] : 'medium';

    this.ai = new AIPlayer(difficulty);

    const aiSocketId = 'ai-player';
    this.players.push({ socketId: aiSocketId, userId: null, isAI: true, ready: true });
    this.boards[aiSocketId] = new Board();
    this.boards[aiSocketId].randomize();
    this._stats[aiSocketId] = { fired: 0, hits: 0 };
  }

  // ---------------------------------------------------------------------------
  // placeShips(socketId, ships)
  //   Calls board.placeAllShips(), marks the player ready.
  //   When all players are ready, transitions to 'playing' and sets currentTurn
  //   to players[0].socketId.
  // ---------------------------------------------------------------------------
  placeShips(socketId, ships) {
    const player = this._getPlayer(socketId);
    if (!player) {
      throw new Error('player_not_found: No player with socketId ' + socketId);
    }

    this.boards[socketId].placeAllShips(ships);
    player.ready = true;

    // Transition to playing if all players are ready
    const allReady = this.players.length === 2 && this.players.every(p => p.ready);
    if (allReady) {
      this.phase = 'playing';
      this.currentTurn = this.players[0].socketId;
      this.startedAt = Date.now();
    }
  }

  // ---------------------------------------------------------------------------
  // fire(socketId, row, col)
  //   Validates phase and turn, attacks opponent's board, increments turnCount.
  //   Checks for game over. For AI games: immediately processes AI counter-move,
  //   returns aiMove in result, keeps turn with human. For PvP: switches turn.
  //
  //   Returns { result, shipName, sunk, gameOver, winner, aiMove? }
  // ---------------------------------------------------------------------------
  fire(socketId, row, col) {
    if (this.phase !== 'playing') {
      throw new Error('not_playing: Game is not in playing phase');
    }

    if (this.currentTurn !== socketId) {
      throw new Error('not_your_turn: It is not your turn');
    }

    // Find opponent
    const opponent = this.players.find(p => p.socketId !== socketId);
    const opponentBoard = this.boards[opponent.socketId];

    // Attack opponent's board
    const attackResult = opponentBoard.receiveAttack(row, col);

    // Update stats
    this._stats[socketId].fired += 1;
    if (attackResult.hit) {
      this._stats[socketId].hits += 1;
    }

    this.turnCount += 1;

    // Check for game over
    let gameOver = false;
    if (opponentBoard.allShipsSunk()) {
      gameOver = true;
      this.phase = 'finished';
      this.winner = socketId;
      this.endedAt = Date.now();
    }

    const fireResult = {
      result: attackResult.hit ? 'hit' : 'miss',
      shipName: attackResult.sunkShip || null,
      sunk: attackResult.sunk,
      gameOver,
      winner: gameOver ? socketId : null,
    };

    // AI counter-move (only if game is still active)
    if (!gameOver && this.ai && opponent.isAI) {
      const aiSocketId = opponent.socketId;
      const humanBoard = this.boards[socketId];

      // AI picks a move
      const aiMove = this.ai.getMove(humanBoard);
      const aiAttack = humanBoard.receiveAttack(aiMove.row, aiMove.col);

      // Update AI stats
      this._stats[aiSocketId].fired += 1;
      if (aiAttack.hit) {
        this._stats[aiSocketId].hits += 1;
      }

      // Record result back into AI
      this.ai.recordResult(
        aiMove.row,
        aiMove.col,
        aiAttack.hit ? 'hit' : 'miss',
        aiAttack.sunk
      );

      this.turnCount += 1;

      // Check if AI won
      if (humanBoard.allShipsSunk()) {
        this.phase = 'finished';
        this.winner = aiSocketId;
        this.endedAt = Date.now();
        fireResult.gameOver = true;
        fireResult.winner = aiSocketId;
      }

      // Turn stays with human
      fireResult.aiMove = {
        row: aiMove.row,
        col: aiMove.col,
        result: aiAttack.hit ? 'hit' : 'miss',
        shipName: aiAttack.sunkShip || null,
        sunk: aiAttack.sunk,
      };
    } else if (!gameOver) {
      // PvP: switch turns
      this.currentTurn = opponent.socketId;
    }

    return fireResult;
  }

  // ---------------------------------------------------------------------------
  // getState(socketId)
  //   Returns the game state scoped to the requesting player.
  //   myBoard shows ships (hidden=false); enemyBoard hides ships (hidden=true).
  // ---------------------------------------------------------------------------
  getState(socketId) {
    const opponent = this.players.find(p => p.socketId !== socketId);

    return {
      roomId: this.id,
      mode: this.mode,
      phase: this.phase,
      currentTurn: this.currentTurn,
      turnCount: this.turnCount,
      myBoard: this.boards[socketId] ? this.boards[socketId].getState(false) : null,
      enemyBoard: opponent && this.boards[opponent.socketId]
        ? this.boards[opponent.socketId].getState(true)
        : null,
      winner: this.winner,
    };
  }

  // ---------------------------------------------------------------------------
  // getStats()
  //   Returns stats suitable for DB storage.
  // ---------------------------------------------------------------------------
  getStats() {
    const p1 = this.players[0] || null;
    const p2 = this.players[1] || null;

    const p1Stats = p1 ? this._stats[p1.socketId] : { fired: 0, hits: 0 };
    const p2Stats = p2 ? this._stats[p2.socketId] : { fired: 0, hits: 0 };

    const durationSeconds = this.startedAt && this.endedAt
      ? Math.round((this.endedAt - this.startedAt) / 1000)
      : null;

    return {
      player1_id: p1 ? p1.userId : null,
      player2_id: p2 ? p2.userId : null,
      mode: this.mode,
      winner_id: this.winner
        ? (this.players.find(p => p.socketId === this.winner) || {}).userId || null
        : null,
      winner_anonymous: this.winner === null,
      turns: this.turnCount,
      player1_accuracy: p1Stats.fired > 0
        ? Math.round((p1Stats.hits / p1Stats.fired) * 100) / 100
        : 0,
      player2_accuracy: p2Stats.fired > 0
        ? Math.round((p2Stats.hits / p2Stats.fired) * 100) / 100
        : 0,
      duration_seconds: durationSeconds,
    };
  }

  // ---------------------------------------------------------------------------
  // reconnect(oldSocketId, newSocketId)
  //   Moves board reference and updates player socketId. Also updates currentTurn
  //   if the reconnecting player was the active turn holder.
  // ---------------------------------------------------------------------------
  reconnect(oldSocketId, newSocketId) {
    const player = this._getPlayer(oldSocketId);
    if (!player) {
      throw new Error('player_not_found: No player with socketId ' + oldSocketId);
    }

    // Update player record
    player.socketId = newSocketId;

    // Move board reference
    this.boards[newSocketId] = this.boards[oldSocketId];
    delete this.boards[oldSocketId];

    // Move stats reference
    if (this._stats[oldSocketId]) {
      this._stats[newSocketId] = this._stats[oldSocketId];
      delete this._stats[oldSocketId];
    }

    // Update currentTurn if this player was active
    if (this.currentTurn === oldSocketId) {
      this.currentTurn = newSocketId;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId) || null;
  }
}

module.exports = GameRoom;

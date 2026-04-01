/* ui.js — Screen navigation, menu interactions, ship placement, leaderboard
 * Loaded after auth.js and game.js.
 * Exposes globals: showScreen(), showGameOver(), initPlacement()
 */

'use strict';

// ---------------------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------------------

/**
 * showScreen(screenId)
 * Hides all .screen elements and activates the target screen.
 * Global because game.js calls it.
 */
function showScreen(screenId) {
  var screens = document.querySelectorAll('.screen');
  screens.forEach(function (s) {
    s.classList.remove('active');
  });
  var target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

// ---------------------------------------------------------------------------
// Game Over
// ---------------------------------------------------------------------------

/**
 * showGameOver(data)
 * Populates and shows the game over screen.
 * data: { winner, turns, duration, accuracy, reason }
 */
function showGameOver(data) {
  data = data || {};

  var title = document.getElementById('gameover-title');
  if (title) {
    title.textContent = data.won ? 'VICTORY' : 'DEFEAT';
  }

  var statsEl = document.getElementById('gameover-stats');
  if (statsEl) {
    var lines = [];
    if (data.turns !== undefined) lines.push('Turns: ' + data.turns);
    if (data.duration !== undefined) {
      lines.push('Duration: ' + Math.round(data.duration / 1000) + 's');
    }
    if (data.accuracy !== undefined) {
      lines.push('Accuracy: ' + data.accuracy + '%');
    }
    if (data.reason) {
      var reasons = { opponent_disconnected: 'Opponent disconnected' };
      lines.push('Reason: ' + (reasons[data.reason] || data.reason));
    }
    statsEl.innerHTML = lines.map(function (l) {
      return '<div>' + l + '</div>';
    }).join('');
  }

  showScreen('screen-gameover');
}

// ---------------------------------------------------------------------------
// Ship Placement
// ---------------------------------------------------------------------------

var FLEET = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];

var placementState = {
  selectedShip: 0,
  orientation: 'horizontal',
  placedShips: [],
  // 10x10 grid tracking which cells are occupied
  occupiedGrid: null
};

function _initOccupiedGrid() {
  var grid = [];
  for (var r = 0; r < 10; r++) {
    grid.push([false, false, false, false, false, false, false, false, false, false]);
  }
  return grid;
}

function _getShipCells(col, row, size, orientation) {
  var cells = [];
  for (var i = 0; i < size; i++) {
    if (orientation === 'horizontal') {
      cells.push({ col: col + i, row: row });
    } else {
      cells.push({ col: col, row: row + i });
    }
  }
  return cells;
}

function _isValidPlacement(col, row, size, orientation, occupiedGrid) {
  var cells = _getShipCells(col, row, size, orientation);
  for (var i = 0; i < cells.length; i++) {
    var c = cells[i].col;
    var r = cells[i].row;
    // Bounds check
    if (c < 0 || c >= 10 || r < 0 || r >= 10) return false;
    // Overlap check
    if (occupiedGrid[r][c]) return false;
  }
  return true;
}

function _markCells(col, row, size, orientation, occupiedGrid) {
  var cells = _getShipCells(col, row, size, orientation);
  cells.forEach(function (cell) {
    occupiedGrid[cell.row][cell.col] = true;
  });
}

/**
 * initPlacement()
 * Renders ship list and empty board. Called when placement screen is shown.
 * Global because game.js (via showScreen) transitions to placement, and
 * the socket event listener in game.js may need to call it.
 */
function initPlacement() {
  // Reset state
  placementState.selectedShip = 0;
  placementState.orientation = 'horizontal';
  placementState.placedShips = [];
  placementState.occupiedGrid = _initOccupiedGrid();

  _renderShipList();
  _renderPlacementBoard();
  _renderPlacementBoardCells();

  // Ready button starts disabled
  var readyBtn = document.getElementById('btn-ready');
  if (readyBtn) readyBtn.disabled = true;
}

function _renderShipList() {
  var list = document.getElementById('ship-list');
  if (!list) return;
  list.innerHTML = '';

  FLEET.forEach(function (ship, idx) {
    var item = document.createElement('div');
    item.className = 'ship-item';
    item.setAttribute('data-ship-index', idx);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'ship-name';
    nameSpan.textContent = ship.name;

    var sizeSpan = document.createElement('span');
    sizeSpan.className = 'ship-size';
    sizeSpan.textContent = '[' + ship.size + ']';

    item.appendChild(nameSpan);
    item.appendChild(sizeSpan);

    item.addEventListener('click', function () {
      // Only selectable if not yet placed
      var placed = placementState.placedShips.some(function (p) {
        return p.name === ship.name;
      });
      if (!placed) {
        placementState.selectedShip = idx;
        _updateShipListUI();
      }
    });

    list.appendChild(item);
  });

  _updateShipListUI();
}

function _updateShipListUI() {
  var items = document.querySelectorAll('.ship-item');
  items.forEach(function (item) {
    var idx = parseInt(item.getAttribute('data-ship-index'), 10);
    item.classList.remove('selected', 'placed');

    var isPlaced = placementState.placedShips.some(function (p) {
      return p.name === FLEET[idx].name;
    });
    if (isPlaced) {
      item.classList.add('placed');
    } else if (idx === placementState.selectedShip) {
      item.classList.add('selected');
    }
  });
}

function _renderPlacementBoard() {
  var board = document.getElementById('board-placement');
  if (!board) return;
  board.innerHTML = '';
}

function _renderPlacementBoardCells() {
  var board = document.getElementById('board-placement');
  if (!board) return;
  board.innerHTML = '';

  for (var row = 0; row < 10; row++) {
    for (var col = 0; col < 10; col++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-row', row);
      cell.setAttribute('data-col', col);

      (function (r, c) {
        cell.addEventListener('click', function () {
          _handlePlacementClick(r, c);
        });
        cell.addEventListener('mouseenter', function () {
          _handlePlacementHover(r, c);
        });
        cell.addEventListener('mouseleave', function () {
          _clearPreview();
        });
      })(row, col);

      board.appendChild(cell);
    }
  }

  // Re-render already-placed ships
  _redrawPlacedShips();
}

function _handlePlacementClick(row, col) {
  var idx = placementState.selectedShip;
  // Find the first unplaced ship if current is already placed
  var ship = FLEET[idx];
  if (!ship) return;

  var isPlaced = placementState.placedShips.some(function (p) {
    return p.name === ship.name;
  });
  if (isPlaced) return;

  var valid = _isValidPlacement(col, row, ship.size, placementState.orientation, placementState.occupiedGrid);
  if (!valid) return;

  // Mark on grid
  _markCells(col, row, ship.size, placementState.orientation, placementState.occupiedGrid);

  // Record placement
  placementState.placedShips.push({
    name: ship.name.toLowerCase(),
    col: col,
    row: row,
    size: ship.size,
    orientation: placementState.orientation
  });

  // Update UI
  _redrawPlacedShips();
  _updateShipListUI();

  // Auto-select next unplaced ship
  var nextIdx = -1;
  for (var i = 0; i < FLEET.length; i++) {
    var isAlreadyPlaced = placementState.placedShips.some(function (p) {
      return p.name === FLEET[i].name.toLowerCase();
    });
    if (!isAlreadyPlaced) {
      nextIdx = i;
      break;
    }
  }

  if (nextIdx !== -1) {
    placementState.selectedShip = nextIdx;
    _updateShipListUI();
  } else {
    // All ships placed — enable ready button
    var readyBtn = document.getElementById('btn-ready');
    if (readyBtn) readyBtn.disabled = false;
  }
}

function _handlePlacementHover(row, col) {
  _clearPreview();

  var idx = placementState.selectedShip;
  var ship = FLEET[idx];
  if (!ship) return;

  var isPlaced = placementState.placedShips.some(function (p) {
    return p.name === ship.name.toLowerCase();
  });
  if (isPlaced) return;

  var cells = _getShipCells(col, row, ship.size, placementState.orientation);
  var valid = _isValidPlacement(col, row, ship.size, placementState.orientation, placementState.occupiedGrid);

  var board = document.getElementById('board-placement');
  if (!board) return;

  cells.forEach(function (pos) {
    if (pos.col >= 0 && pos.col < 10 && pos.row >= 0 && pos.row < 10) {
      var cell = board.querySelector(
        '.cell[data-row="' + pos.row + '"][data-col="' + pos.col + '"]'
      );
      if (cell) {
        cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      }
    }
  });
}

function _clearPreview() {
  var board = document.getElementById('board-placement');
  if (!board) return;
  var previewCells = board.querySelectorAll('.preview-valid, .preview-invalid');
  previewCells.forEach(function (cell) {
    cell.classList.remove('preview-valid', 'preview-invalid');
  });
}

function _redrawPlacedShips() {
  var board = document.getElementById('board-placement');
  if (!board) return;

  // Clear ship class from all cells first
  var allCells = board.querySelectorAll('.cell');
  allCells.forEach(function (cell) {
    cell.classList.remove('ship');
  });

  // Re-apply ship class for each placed ship
  placementState.placedShips.forEach(function (placed) {
    var cells = _getShipCells(placed.col, placed.row, placed.size, placed.orientation);
    cells.forEach(function (pos) {
      var cell = board.querySelector(
        '.cell[data-row="' + pos.row + '"][data-col="' + pos.col + '"]'
      );
      if (cell) cell.classList.add('ship');
    });
  });
}

function _randomizePlacement() {
  // Reset
  placementState.placedShips = [];
  placementState.occupiedGrid = _initOccupiedGrid();

  for (var i = 0; i < FLEET.length; i++) {
    var ship = FLEET[i];
    var placed = false;
    var attempts = 0;

    while (!placed && attempts < 200) {
      attempts++;
      var orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      var col = Math.floor(Math.random() * 10);
      var row = Math.floor(Math.random() * 10);

      if (_isValidPlacement(col, row, ship.size, orientation, placementState.occupiedGrid)) {
        _markCells(col, row, ship.size, orientation, placementState.occupiedGrid);
        placementState.placedShips.push({
          name: ship.name.toLowerCase(),
          col: col,
          row: row,
          size: ship.size,
          orientation: orientation
        });
        placed = true;
      }
    }
  }

  // Update selected ship (none remain unplaced)
  placementState.selectedShip = 0;
  _renderPlacementBoardCells();
  _updateShipListUI();

  // All ships placed — enable ready button
  var readyBtn = document.getElementById('btn-ready');
  if (readyBtn) readyBtn.disabled = false;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function fetchLeaderboard() {
  var tbody = document.getElementById('leaderboard-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  fetch('/api/leaderboard')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!tbody) return;
      tbody.innerHTML = '';

      var players = Array.isArray(data) ? data : (data.players || data.leaderboard || []);

      if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No data yet.</td></tr>';
        return;
      }

      players.forEach(function (player, idx) {
        var tr = document.createElement('tr');

        var rank = document.createElement('td');
        rank.textContent = idx + 1;

        var name = document.createElement('td');
        name.textContent = player.username || player.name || '—';

        var wins = document.createElement('td');
        wins.textContent = player.wins !== undefined ? player.wins : '—';

        var losses = document.createElement('td');
        losses.textContent = player.losses !== undefined ? player.losses : '—';

        var total = (player.wins || 0) + (player.losses || 0);
        var winRate = document.createElement('td');
        winRate.textContent = total > 0
          ? Math.round((player.wins / total) * 100) + '%'
          : '—';

        tr.appendChild(rank);
        tr.appendChild(name);
        tr.appendChild(wins);
        tr.appendChild(losses);
        tr.appendChild(winRate);
        tbody.appendChild(tr);
      });
    })
    .catch(function () {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5">Failed to load leaderboard.</td></tr>';
    });
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — wire everything up
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {

  // --- Core init ---
  if (typeof connectSocket === 'function') connectSocket();
  if (typeof AuthUI !== 'undefined') AuthUI.init();
  // SoundManager.init() is already called at the bottom of game.js

  // --- AI mode buttons ---
  var modeButtons = document.querySelectorAll('[data-mode]');
  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode');
      // Extract difficulty: ai_easy → easy, ai_medium → medium, ai_hard → hard
      var difficulty = mode.replace('ai_', '');
      if (socket) socket.emit('create-ai-game', { difficulty: difficulty });
    });
  });

  // --- Create Room ---
  var btnCreateRoom = document.getElementById('btn-create-room');
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', function () {
      if (socket) socket.emit('create-room');
    });
  }

  // --- Join Room ---
  var btnJoinRoom = document.getElementById('btn-join-room');
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', function () {
      var input = document.getElementById('input-room-code');
      var code = input ? input.value.trim() : '';
      if (code && socket) socket.emit('join-room', { roomId: code });
    });
  }

  // --- Find Opponent (matchmaking) ---
  var btnMatchmake = document.getElementById('btn-find-opponent');
  if (btnMatchmake) {
    btnMatchmake.addEventListener('click', function () {
      if (socket) socket.emit('matchmake');
    });
  }

  // --- Cancel matchmaking ---
  var btnCancelWait = document.getElementById('btn-cancel-wait');
  if (btnCancelWait) {
    btnCancelWait.addEventListener('click', function () {
      if (socket) socket.emit('cancel-matchmake');
      showScreen('screen-menu');
    });
  }

  // --- Cancel room ---
  var btnCancelRoom = document.getElementById('btn-cancel-room');
  if (btnCancelRoom) {
    btnCancelRoom.addEventListener('click', function () {
      if (socket) socket.emit('cancel-room');
      showScreen('screen-menu');
    });
  }

  // --- Leaderboard ---
  var btnLeaderboard = document.getElementById('btn-leaderboard');
  if (btnLeaderboard) {
    btnLeaderboard.addEventListener('click', function () {
      fetchLeaderboard();
      showScreen('screen-leaderboard');
    });
  }

  var btnBackLeaderboard = document.getElementById('btn-back-leaderboard');
  if (btnBackLeaderboard) {
    btnBackLeaderboard.addEventListener('click', function () {
      showScreen('screen-menu');
    });
  }

  // --- Auth modal ---
  var btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', function () {
      AuthUI.showModal('login');
    });
  }

  var btnCloseAuth = document.getElementById('btn-close-auth');
  if (btnCloseAuth) {
    btnCloseAuth.addEventListener('click', function () {
      AuthUI.hideModal();
    });
  }

  // Close modal on overlay click
  var modalOverlay = document.getElementById('modal-auth-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function () {
      AuthUI.hideModal();
    });
  }

  // --- Sound toggle ---
  var btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    btnSound.addEventListener('click', function () {
      var muted = SoundManager.toggle();
      btnSound.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
  }

  // --- Play Again / Main Menu (game over screen) ---
  var btnPlayAgain = document.getElementById('btn-play-again');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', function () {
      showScreen('screen-menu');
    });
  }

  var btnMainMenu = document.getElementById('btn-main-menu');
  if (btnMainMenu) {
    btnMainMenu.addEventListener('click', function () {
      showScreen('screen-menu');
    });
  }

  // --- Ship placement controls ---

  // Rotate button
  var btnRotate = document.getElementById('btn-rotate');
  if (btnRotate) {
    btnRotate.addEventListener('click', function () {
      placementState.orientation =
        placementState.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      btnRotate.textContent =
        'Rotate Ship [' + placementState.orientation.toUpperCase().charAt(0) + ']';
    });
  }

  // R key shortcut for rotate
  document.addEventListener('keydown', function (e) {
    var activeScreen = document.querySelector('#screen-placement.active');
    if (!activeScreen) return;
    if (e.key === 'r' || e.key === 'R') {
      placementState.orientation =
        placementState.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      if (btnRotate) {
        btnRotate.textContent =
          'Rotate Ship [' + placementState.orientation.toUpperCase().charAt(0) + ']';
      }
    }
  });

  // Randomize button
  var btnRandomize = document.getElementById('btn-randomize');
  if (btnRandomize) {
    btnRandomize.addEventListener('click', function () {
      _randomizePlacement();
    });
  }

  // Ready button
  var btnReady = document.getElementById('btn-ready');
  if (btnReady) {
    btnReady.addEventListener('click', function () {
      if (placementState.placedShips.length < FLEET.length) return;
      if (socket) {
        socket.emit('place-ships', { ships: placementState.placedShips });
      }
    });
  }

  // Initialize placement board when placement screen becomes active
  // game.js calls showScreen('screen-placement'), which we intercept by
  // patching showScreen to also call initPlacement when needed.
  var _origShowScreen = showScreen;
  showScreen = function (screenId) {
    _origShowScreen(screenId);
    if (screenId === 'screen-placement') {
      initPlacement();
    }
  };

});

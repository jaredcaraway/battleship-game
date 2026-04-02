/* ui.js — Screen navigation, menu interactions, ship placement, leaderboard
 * Loaded after auth.js and game.js.
 * Exposes globals: showScreen(), showGameOver(), initPlacement()
 */

'use strict';

// Global motion settings — checked by all animation/effect functions
var MotionSettings = {
  enabled: true,
  init: function () {
    // Respect OS-level preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.enabled = false;
    }
    // Override with saved user preference
    var saved = localStorage.getItem('cyber-ship-battle-motion');
    if (saved === 'off') this.enabled = false;
    if (saved === 'on') this.enabled = true;
    this._applyClass();
  },
  toggle: function () {
    this.enabled = !this.enabled;
    localStorage.setItem('cyber-ship-battle-motion', this.enabled ? 'on' : 'off');
    this._applyClass();
    return this.enabled;
  },
  _applyClass: function () {
    document.documentElement.classList.toggle('reduce-motion', !this.enabled);
  }
};
MotionSettings.init();

// Track last game mode for Play Again
var _lastGameMode = null; // { type: 'ai', difficulty: 'easy' } or { type: 'multiplayer' }

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
  window.scrollTo(0, 0);

  // Hide SEO content and ads during gameplay, show on menu
  var seo = document.getElementById('seo-content');
  var adTop = document.getElementById('ad-top');
  var adBottom = document.getElementById('ad-bottom');
  var isMenu = screenId === 'screen-menu';
  if (seo) seo.style.display = isMenu ? '' : 'none';
  if (adTop) adTop.style.display = isMenu ? '' : 'none';
  if (adBottom) adBottom.style.display = isMenu ? '' : 'none';
}

// ---------------------------------------------------------------------------
// Game Over
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Victory confetti — lazy-loads canvas-confetti on first win
// ---------------------------------------------------------------------------
var _confettiLoaded = false;

function _loadConfetti(callback) {
  if (_confettiLoaded) { callback(); return; }
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
  script.onload = function () { _confettiLoaded = true; callback(); };
  script.onerror = function () { /* silently skip if CDN unreachable */ };
  document.head.appendChild(script);
}

function _fireVictoryConfetti() {
  if (!MotionSettings.enabled) return;
  _loadConfetti(function () {
    if (typeof confetti !== 'function') return;

    // Green-themed burst from both sides
    var colors = ['#00ff80', '#00cc66', '#33ff99', '#00ff4c', '#88ffbb'];
    var defaults = { colors: colors, ticks: 200, spread: 70, gravity: 0.8 };

    confetti(Object.assign({}, defaults, {
      particleCount: 80,
      angle: 60,
      origin: { x: 0, y: 0.7 }
    }));
    confetti(Object.assign({}, defaults, {
      particleCount: 80,
      angle: 120,
      origin: { x: 1, y: 0.7 }
    }));

    // Second burst after a short delay
    setTimeout(function () {
      confetti(Object.assign({}, defaults, {
        particleCount: 60,
        angle: 90,
        spread: 100,
        origin: { x: 0.5, y: 0.5 }
      }));
    }, 400);
  });
}

/**
 * showGameOver(data)
 * Populates and shows the game over screen.
 * data: { winner, turns, duration, accuracy, reason }
 */
function showGameOver(data) {
  data = data || {};

  var title = document.getElementById('gameover-title');
  if (title) {
    title.textContent = data.won ? 'VICTORY!' : 'DEFEAT';
    title.classList.remove('victory', 'defeat');
    // Force reflow to restart CSS animation if replaying
    void title.offsetWidth;
    title.classList.add(data.won ? 'victory' : 'defeat');

    // Restart SVG filter animations for defeat wave effect
    if (!data.won && MotionSettings.enabled) {
      var anims = document.querySelectorAll('#defeat-wave animate');
      anims.forEach(function (a) { a.beginElement(); });
    }
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

  if (data.won) _fireVictoryConfetti();
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
  occupiedGrid: null,
  lastHoverRow: -1,
  lastHoverCol: -1
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
      var shipNameLower = ship.name.toLowerCase();
      var placedIdx = placementState.placedShips.findIndex(function (p) {
        return p.name === shipNameLower;
      });

      if (placedIdx !== -1) {
        // Clicking a placed ship — remove it from board and re-select
        _pickUpPlacedShip(placedIdx);
      } else if (placementState.selectedShip === idx) {
        // Clicking the currently selected ship — deselect (drop it)
        placementState.selectedShip = -1;
        _updateShipListUI();
        _clearPreview();
      } else {
        // Clicking an unplaced, unselected ship — select it
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
      return p.name === FLEET[idx].name.toLowerCase();
    });
    if (isPlaced) {
      item.classList.add('placed');
    } else if (idx === placementState.selectedShip) {
      item.classList.add('selected');
    }
  });

  // Update undo button state
  var undo = document.getElementById('btn-undo');
  if (undo) undo.disabled = placementState.placedShips.length === 0;
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
          placementState.lastHoverRow = -1;
          placementState.lastHoverCol = -1;
          _clearPreview();
        });
      })(row, col);

      board.appendChild(cell);
    }
  }

  // Re-render already-placed ships
  _redrawPlacedShips();
}

function _findPlacedShipAt(row, col) {
  for (var i = 0; i < placementState.placedShips.length; i++) {
    var p = placementState.placedShips[i];
    var cells = _getShipCells(p.col, p.row, p.size, p.orientation);
    for (var j = 0; j < cells.length; j++) {
      if (cells[j].row === row && cells[j].col === col) return i;
    }
  }
  return -1;
}

function _pickUpPlacedShip(placedIdx) {
  var removed = placementState.placedShips[placedIdx];
  var cells = _getShipCells(removed.col, removed.row, removed.size, removed.orientation);
  cells.forEach(function (c) {
    placementState.occupiedGrid[c.row][c.col] = false;
  });
  placementState.placedShips.splice(placedIdx, 1);

  // Find the FLEET index for this ship
  var fleetIdx = -1;
  for (var i = 0; i < FLEET.length; i++) {
    if (FLEET[i].name.toLowerCase() === removed.name) {
      fleetIdx = i;
      break;
    }
  }

  placementState.selectedShip = fleetIdx;
  placementState.orientation = removed.orientation;
  _redrawPlacedShips();
  _updateShipListUI();

  var readyBtn = document.getElementById('btn-ready');
  if (readyBtn) readyBtn.disabled = true;
}

function _handlePlacementClick(row, col) {
  var idx = placementState.selectedShip;
  var ship = FLEET[idx];

  // If no ship selected or selected ship is already placed, try picking up from board
  var holdingShip = ship && !placementState.placedShips.some(function (p) {
    return p.name === ship.name.toLowerCase();
  });

  if (!holdingShip) {
    var placedIdx = _findPlacedShipAt(row, col);
    if (placedIdx !== -1) _pickUpPlacedShip(placedIdx);
    return;
  }

  var shipNameLower = ship.name.toLowerCase();

  var valid = _isValidPlacement(col, row, ship.size, placementState.orientation, placementState.occupiedGrid);
  if (!valid) return;

  // Mark on grid
  _markCells(col, row, ship.size, placementState.orientation, placementState.occupiedGrid);

  // Record placement
  placementState.placedShips.push({
    name: shipNameLower,
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
    var fleetNameLower = FLEET[i].name.toLowerCase();
    var isAlreadyPlaced = placementState.placedShips.some(function (p) {
      return p.name === fleetNameLower;
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
  placementState.lastHoverRow = row;
  placementState.lastHoverCol = col;
  _clearPreview();

  var idx = placementState.selectedShip;
  var ship = FLEET[idx];

  // Check if user is holding a ship
  var holdingShip = ship && !placementState.placedShips.some(function (p) {
    return p.name === ship.name.toLowerCase();
  });

  // If not holding a ship, show pickup tooltip on placed ships
  if (!holdingShip) {
    var placedIdx = _findPlacedShipAt(row, col);
    if (placedIdx !== -1) {
      var placed = placementState.placedShips[placedIdx];
      var placedCells = _getShipCells(placed.col, placed.row, placed.size, placed.orientation);
      var board = document.getElementById('board-placement');
      if (board) {
        // Capitalize ship name for display
        var displayName = placed.name.charAt(0).toUpperCase() + placed.name.slice(1);
        placedCells.forEach(function (pos) {
          var cell = board.querySelector(
            '.cell[data-row="' + pos.row + '"][data-col="' + pos.col + '"]'
          );
          if (cell) cell.title = 'Pick up ' + displayName;
        });
      }
    }
    return;
  }

  if (!ship) return;

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
  // Clear tooltips
  var titledCells = board.querySelectorAll('.cell[title]');
  titledCells.forEach(function (cell) { cell.removeAttribute('title'); });
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

  // --- Mode tabs ---
  var modeTabs = document.querySelectorAll('.mode-tab');
  modeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      modeTabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      var panels = document.querySelectorAll('.tab-panel');
      panels.forEach(function (p) { p.classList.remove('active'); });
      var target = document.getElementById(tab.getAttribute('data-tab'));
      if (target) target.classList.add('active');
    });
  });

  // --- AI mode buttons ---
  var modeButtons = document.querySelectorAll('[data-mode]');
  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode');
      // Extract difficulty: ai_easy → easy, ai_medium → medium, ai_hard → hard
      var difficulty = mode.replace('ai_', '');
      _lastGameMode = { type: 'ai', difficulty: difficulty };
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

  // --- Copy room code on click ---
  var roomCodeDisplay = document.getElementById('room-code-display');
  var roomCodeWrapper = roomCodeDisplay && roomCodeDisplay.closest('.room-code-wrapper');
  var roomCodeCopied = document.getElementById('room-code-copied');
  if (roomCodeWrapper) {
    roomCodeWrapper.addEventListener('click', function () {
      var code = roomCodeDisplay.textContent.trim();
      if (!code) return;
      navigator.clipboard.writeText(code).then(function () {
        if (roomCodeCopied) {
          roomCodeCopied.removeAttribute('hidden');
          clearTimeout(roomCodeCopied._timer);
          roomCodeCopied._timer = setTimeout(function () {
            roomCodeCopied.setAttribute('hidden', '');
          }, 1500);
        }
      });
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

  // --- Settings modal ---
  var modalSettings = document.getElementById('modal-settings');
  var btnSettings = document.getElementById('btn-settings');
  var btnCloseSettings = document.getElementById('btn-close-settings');
  var settingsOverlay = document.getElementById('modal-settings-overlay');

  function openSettings() {
    if (modalSettings) {
      modalSettings.removeAttribute('hidden');
      modalSettings.classList.add('active');
    }
  }

  function closeSettings() {
    if (modalSettings) {
      modalSettings.classList.remove('active');
      modalSettings.setAttribute('hidden', '');
    }
  }

  if (btnSettings) btnSettings.addEventListener('click', openSettings);
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
  if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);

  // --- Sound toggle (inside settings) ---
  var btnSound = document.getElementById('btn-sound');
  var soundIcon = '<svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/>';
  var iconOn = soundIcon + '<path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
  var iconOff = soundIcon + '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

  function _updateSoundButton(muted) {
    if (!btnSound) return;
    var textEl = btnSound.querySelector('.toggle-text');
    if (textEl) textEl.textContent = muted ? 'OFF' : 'ON';
    var iconEl = btnSound.querySelector('.toggle-icon');
    if (iconEl) iconEl.outerHTML = muted ? iconOff : iconOn;
    btnSound.classList.toggle('toggle-off', muted);
  }

  // Restore saved preference
  var savedSound = localStorage.getItem('battleship-sound');
  if (savedSound === 'on') {
    SoundManager.muted = false;
  }
  _updateSoundButton(SoundManager.muted);

  if (btnSound) {
    btnSound.addEventListener('click', function () {
      var muted = SoundManager.toggle();
      _updateSoundButton(muted);
      localStorage.setItem('battleship-sound', muted ? 'off' : 'on');
    });
  }

  // --- Motion toggle (inside settings) ---
  var btnMotion = document.getElementById('btn-motion');
  function _updateMotionButton(enabled) {
    if (!btnMotion) return;
    var textEl = btnMotion.querySelector('.toggle-text');
    if (textEl) textEl.textContent = enabled ? 'ON' : 'OFF';
    btnMotion.classList.toggle('toggle-off', !enabled);
  }

  if (btnMotion) {
    _updateMotionButton(MotionSettings.enabled);
    btnMotion.addEventListener('click', function () {
      var enabled = MotionSettings.toggle();
      _updateMotionButton(enabled);
    });
  }

  // --- Play Again / Main Menu (game over screen) ---
  var btnPlayAgain = document.getElementById('btn-play-again');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', function () {
      if (_lastGameMode && _lastGameMode.type === 'ai' && socket) {
        socket.emit('create-ai-game', { difficulty: _lastGameMode.difficulty });
      } else {
        showScreen('screen-menu');
      }
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

  function _rotateShip() {
    placementState.orientation =
      placementState.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    if (btnRotate) {
      btnRotate.textContent = 'Rotate [R]';
    }
    // Refresh hover preview so the rotated orientation is visible immediately
    if (placementState.lastHoverRow >= 0 && placementState.lastHoverCol >= 0) {
      _handlePlacementHover(placementState.lastHoverRow, placementState.lastHoverCol);
    }
  }

  if (btnRotate) {
    btnRotate.addEventListener('click', _rotateShip);
  }

  // Randomize button
  var btnRandomize = document.getElementById('btn-randomize');
  if (btnRandomize) {
    btnRandomize.addEventListener('click', function () {
      _randomizePlacement();
    });
  }

  // Undo button
  var btnUndo = document.getElementById('btn-undo');

  function _updateUndoState() {
    if (btnUndo) {
      btnUndo.disabled = placementState.placedShips.length === 0;
    }
  }

  function _undoLastPlacement() {
    if (placementState.placedShips.length === 0) return;
    var lastIdx = placementState.placedShips.length - 1;
    _pickUpPlacedShip(lastIdx);
    _updateUndoState();
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', _undoLastPlacement);
  }

  // Ready button
  var btnReady = document.getElementById('btn-ready');
  function _submitReady() {
    if (!btnReady || btnReady.disabled) return;
    if (placementState.placedShips.length < FLEET.length) return;
    if (socket) {
      socket.emit('place-ships', { ships: placementState.placedShips });
    }
  }
  if (btnReady) {
    btnReady.addEventListener('click', _submitReady);
  }

  // Keyboard shortcuts for placement screen
  document.addEventListener('keydown', function (e) {
    var activeScreen = document.querySelector('#screen-placement.active');
    if (!activeScreen) return;
    if (e.key === 'r' || e.key === 'R') {
      _rotateShip();
    } else if (e.key === 's' || e.key === 'S') {
      _randomizePlacement();
    } else if (e.key === 'z' || e.key === 'Z') {
      _undoLastPlacement();
    } else if (e.key === 'Enter') {
      _submitReady();
    }
  });

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

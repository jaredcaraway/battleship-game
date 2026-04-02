/* game.js — Cyber Ship Battle client: Socket.io + board rendering + game loop
 * Loaded BEFORE ui.js. Exposes globals consumed by ui.js.
 */

'use strict';

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
var socket = null;
var currentRoomId = null;
var myTurn = false;
var mySocketId = null;
var enemySunkShips = [];

// ---------------------------------------------------------------------------
// SoundManager
// ---------------------------------------------------------------------------
var SoundManager = {
  muted: true,
  sounds: {},

  init: function () {
    document.addEventListener('click', function () {
      SoundManager._load();
    }, { once: true });
  },

  _load: function () {
    var files = { fire: 'fire.wav', hit: 'hit.wav', miss: 'miss.wav', sunk: 'sunk.wav' };
    for (var name in files) {
      if (Object.prototype.hasOwnProperty.call(files, name)) {
        var audio = new Audio('/sounds/' + files[name]);
        audio.preload = 'auto';
        this.sounds[name] = audio;
      }
    }
  },

  play: function (name) {
    if (this.muted) return;
    // Synthesized explosion for sunk events
    if (name === 'explosion') {
      this._playExplosion();
      return;
    }
    if (!this.sounds[name]) return;
    this.sounds[name].currentTime = 0;
    this.sounds[name].play().catch(function () {});
  },

  _playExplosion: function () {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime;

      // White noise burst
      var bufferSize = ctx.sampleRate * 0.4;
      var noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      var noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // Low-pass filter for rumble
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.frequency.exponentialRampToValueAtTime(150, t + 0.5);

      // Noise gain envelope
      var noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1.0, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      // Bass punch oscillator
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);

      var oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.8, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.start(t);
      noise.stop(t + 0.6);
      osc.start(t);
      osc.stop(t + 0.5);
    } catch (e) { /* ignore audio errors */ }
  },

  toggle: function () {
    this.muted = !this.muted;
    return this.muted;
  }
};

// ---------------------------------------------------------------------------
// Board rendering
// ---------------------------------------------------------------------------

/**
 * renderBoard(containerId, grid, clickable)
 * Clears the container and builds a 10x10 grid of div.cell elements.
 * If clickable=true, each cell gets a click handler → fireAt(row, col).
 */
function renderBoard(containerId, grid, clickable) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  for (var row = 0; row < 10; row++) {
    for (var col = 0; col < 10; col++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-row', row);
      cell.setAttribute('data-col', col);

      if (clickable) {
        (function (r, c) {
          cell.addEventListener('click', function () {
            fireAt(r, c);
          });
        })(row, col);
      }

      container.appendChild(cell);
    }
  }
}

/**
 * updateBoard(containerId, gridState)
 * Updates CSS classes on existing cells based on a 10x10 state array.
 * Cell values: null | 'ship' | 'hit' | 'miss'
 */
function updateBoard(containerId, gridState) {
  var container = document.getElementById(containerId);
  if (!container || !gridState) return;

  var cells = container.querySelectorAll('.cell');
  cells.forEach(function (cell) {
    var row = parseInt(cell.getAttribute('data-row'), 10);
    var col = parseInt(cell.getAttribute('data-col'), 10);
    if (isNaN(row) || isNaN(col)) return;

    var state = gridState[row] && gridState[row][col];

    // Reset dynamic classes
    cell.classList.remove('hit', 'miss', 'ship', 'sunk');
    cell.textContent = '';

    if (state === 'hit') {
      cell.classList.add('hit');
      cell.textContent = '\u2715'; // ✕
    } else if (state === 'miss') {
      cell.classList.add('miss');
      cell.textContent = '\u00B7'; // ·
    } else if (state === 'sunk') {
      cell.classList.add('sunk');
      cell.textContent = '\u2715';
    } else if (state) {
      // Any other truthy value is a ship (server sends ship names like 'carrier')
      cell.classList.add('ship');
    }
  });
}

// ---------------------------------------------------------------------------
// fireAt
// ---------------------------------------------------------------------------

/**
 * _shakeScreen(intensity)
 * Shakes the game screen with random jitter.
 * intensity: 'light' (hit) or 'heavy' (sunk)
 */
function _shakeScreen(intensity) {
  if (typeof MotionSettings !== 'undefined' && !MotionSettings.enabled) return;
  var el = document.getElementById('screen-game');
  if (!el) return;

  var frames = intensity === 'heavy' ? 40 : 18;
  var maxOffset = intensity === 'heavy' ? 14 : 6;
  var i = 0;

  function jitter() {
    if (i >= frames) {
      el.style.transform = '';
      return;
    }
    var decay = 1 - (i / frames);
    var x = (Math.random() * 2 - 1) * maxOffset * decay;
    var y = (Math.random() * 2 - 1) * maxOffset * decay;
    el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    i++;
    requestAnimationFrame(jitter);
  }

  requestAnimationFrame(jitter);
}

/**
 * fireAt(row, col)
 * Emits a 'fire' event if it is this player's turn.
 * Temporarily disables the enemy board to prevent double-fire.
 */
function _spawnRipple(row, col) {
  if (typeof MotionSettings !== 'undefined' && !MotionSettings.enabled) return;
  var board = document.getElementById('board-enemy');
  if (!board) return;

  var cells = board.querySelectorAll('.cell');
  var maxDist = 0;

  // Calculate distances from impact point
  cells.forEach(function (cell) {
    var r = parseInt(cell.getAttribute('data-row'), 10);
    var c = parseInt(cell.getAttribute('data-col'), 10);
    var dist = Math.sqrt((r - row) * (r - row) + (c - col) * (c - col));
    if (dist > maxDist) maxDist = dist;
    cell._rippleDist = dist;
  });

  // Animate each cell with delay based on distance
  cells.forEach(function (cell) {
    var dist = cell._rippleDist;
    var delay = dist * 0.05; // 50ms per unit distance
    // Amplitude decreases with distance
    var amplitude = Math.max(0.2, 1 - (dist / maxDist));
    var duration = 0.4 + dist * 0.04; // longer settle for distant cells

    cell.classList.remove('wave');
    void cell.offsetWidth;
    cell.style.setProperty('--wave-delay', delay + 's');
    cell.style.setProperty('--wave-duration', duration + 's');
    cell.style.setProperty('--wave-amplitude', amplitude);
    cell.classList.add('wave');

    delete cell._rippleDist;
  });

  // Clean up after all animations complete
  var cleanupTime = (maxDist * 0.05 + 0.4 + maxDist * 0.04) * 1000 + 100;
  setTimeout(function () {
    cells.forEach(function (cell) {
      cell.classList.remove('wave');
      cell.style.removeProperty('--wave-delay');
      cell.style.removeProperty('--wave-duration');
      cell.style.removeProperty('--wave-amplitude');
    });
  }, cleanupTime);
}

function fireAt(row, col) {
  if (!myTurn) return;
  if (!socket) return;

  // Disable enemy board clicks immediately
  myTurn = false;
  updateTurnIndicator(false);

  _spawnRipple(row, col);
  socket.emit('fire', { row: row, col: col });
  SoundManager.play('fire');
}

// ---------------------------------------------------------------------------
// Helper UI functions
// ---------------------------------------------------------------------------

/**
 * showNotification(message)
 * Appends a div.notification to <body>. CSS fadeOut animation auto-removes it.
 */
function showNotification(message) {
  var el = document.createElement('div');
  el.className = 'notification';
  el.textContent = message;
  document.body.appendChild(el);

  // Remove after animation completes (2s matches the CSS fadeOut)
  setTimeout(function () {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }, 2100);
}

/**
 * updateTurnIndicator(isMyTurn)
 * Updates #status-turn text and styling.
 */
function _playTurnBeep() {
  if (SoundManager.muted) return;
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* ignore audio errors */ }
}

var _myTurnMessages = [
  'LOCK TARGET — FIRE AT WILL',
  'SELECT COORDINATES, COMMANDER',
  'TARGETING SYSTEMS ONLINE',
  'AWAITING YOUR COMMAND',
  'WEAPONS HOT — CHOOSE TARGET'
];

var _opponentTurnMessages = [
  'INCOMING THREAT DETECTED',
  'ENEMY CALCULATING...',
  'BRACE FOR IMPACT',
  'AWAITING INTEL...',
  'HOSTILE TARGETING IN PROGRESS'
];

function _randomMessage(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

var _turnTransitionTimer = null;

function updateTurnIndicator(isMyTurn) {
  var bar = document.getElementById('status-bar');
  var turnEl = document.getElementById('status-turn');
  var msgEl = document.getElementById('status-message');
  if (!bar) return;

  // Clear any pending transition and orphaned canvases
  if (_turnTransitionTimer) clearTimeout(_turnTransitionTimer);
  var oldLines = bar.querySelectorAll('.status-line');
  oldLines.forEach(function (ol) {
    if (ol._animId) cancelAnimationFrame(ol._animId);
    ol.parentNode.removeChild(ol);
  });
  bar.classList.remove('collapsing');

  // Phase 1: collapse text
  bar.classList.add('collapsing');

  // Phase 2: show scanline, swap text while collapsed
  _turnTransitionTimer = setTimeout(function () {
    // Add animated oscilloscope canvas
    var line = document.createElement('canvas');
    line.className = 'status-line';
    line.width = bar.offsetWidth * 0.8;
    line.height = 24;
    bar.appendChild(line);

    var ctx2d = line.getContext('2d');
    var phase = 0;
    var animId = null;

    function drawWave() {
      var w = line.width;
      var h = line.height;
      ctx2d.clearRect(0, 0, w, h);

      // Glow layer
      ctx2d.shadowColor = '#00ff80';
      ctx2d.shadowBlur = 6;
      ctx2d.strokeStyle = '#00ff80';
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();

      for (var x = 0; x < w; x++) {
        var t = x / w;
        var noise = (Math.random() - 0.5) * 3;
        var wave = Math.sin(t * 12 + phase) * 4;
        var spike = Math.random() < 0.03 ? (Math.random() - 0.5) * 10 : 0;
        var y = h / 2 + wave + noise + spike;
        if (x === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();

      // Dimmer second pass for thickness
      ctx2d.shadowBlur = 0;
      ctx2d.globalAlpha = 0.3;
      ctx2d.lineWidth = 3;
      ctx2d.stroke();
      ctx2d.globalAlpha = 1;

      phase += 0.8;
      animId = requestAnimationFrame(drawWave);
    }
    drawWave();

    // Store animId for cleanup
    line._animId = animId;

    // Swap content while hidden
    if (isMyTurn) {
      if (turnEl) { turnEl.textContent = 'YOUR TURN'; turnEl.style.color = '#00ff80'; }
      if (msgEl) msgEl.textContent = _randomMessage(_myTurnMessages);
    } else {
      if (turnEl) { turnEl.textContent = "OPPONENT'S TURN"; turnEl.style.color = '#ff6b6b'; }
      if (msgEl) msgEl.textContent = _randomMessage(_opponentTurnMessages);
    }

    // Phase 3: remove line, expand text
    _turnTransitionTimer = setTimeout(function () {
      if (line._animId) cancelAnimationFrame(line._animId);
      if (line.parentNode) line.parentNode.removeChild(line);
      bar.classList.remove('collapsing');

      // Pulse
      bar.classList.remove('pulse');
      void bar.offsetWidth;
      bar.classList.add('pulse');
    }, 300);
  }, 150);

  if (isMyTurn) _playTurnBeep();
}

/**
 * updateShipStatus(ships)
 * Renders ship name + sunk indicators into #ship-status.
 * ships is an array of { name, sunk } objects.
 */
function updateEnemySunkTracker() {
  var container = document.getElementById('enemy-sunk');
  if (!container) return;
  if (enemySunkShips.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = enemySunkShips.map(function (name) {
    return '<span class="sunk-ship-tag">' + name.toUpperCase() + '</span>';
  }).join('');
}

function showDifficultyBadge() {
  var badge = document.getElementById('difficulty-badge');
  if (!badge) return;
  if (typeof _lastGameMode !== 'undefined' && _lastGameMode && _lastGameMode.type === 'ai') {
    badge.textContent = _lastGameMode.difficulty.toUpperCase();
    badge.className = 'difficulty-badge badge-' + _lastGameMode.difficulty;
    badge.removeAttribute('hidden');
  } else {
    badge.setAttribute('hidden', '');
  }
}

function updateShipStatus(ships) {
  var container = document.getElementById('ship-status');
  if (!container || !Array.isArray(ships)) return;

  container.innerHTML = '';

  ships.forEach(function (ship) {
    var el = document.createElement('span');
    el.className = 'ship-status-item' + (ship.sunk ? ' sunk' : '');
    el.textContent = ship.name + (ship.sunk ? ' [SUNK]' : ' [OK]');
    if (ship.sunk) {
      el.style.color = '#ff0033';
      el.style.textDecoration = 'line-through';
    }
    container.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// Socket connection
// ---------------------------------------------------------------------------

function connectSocket() {
  var token = localStorage.getItem('battleship_token');
  socket = io({ auth: { token: token } });

  // ---- connection lifecycle ------------------------------------------------

  socket.on('connect', function () {
    mySocketId = socket.id;
  });

  // ---- game-created: AI game was created ------------------------------------
  socket.on('game-created', function (data) {
    currentRoomId = data.roomId;
    if (typeof showScreen === 'function') showScreen('screen-placement');
  });

  // ---- room-created: private PvP room created --------------------------------
  socket.on('room-created', function (data) {
    currentRoomId = data.roomId;
    var display = document.getElementById('room-code-display');
    if (display) display.textContent = data.roomId;
    if (typeof showScreen === 'function') showScreen('screen-room');
  });

  // ---- player-joined: second player joined a private room -------------------
  socket.on('player-joined', function (data) {
    var count = data.playerCount;
    var waitingText = document.querySelector('#screen-room .waiting-text');
    if (waitingText) {
      if (count >= 2) {
        waitingText.textContent = 'Opponent joined! Starting...';
      } else {
        waitingText.textContent = 'Waiting for opponent to join...';
      }
    }
    // When the joining player gets this, move them to placement
    if (count >= 2 && socket && socket.id !== null) {
      if (typeof showScreen === 'function') showScreen('screen-placement');
    }
  });

  // ---- match-found: matchmaking succeeded -----------------------------------
  socket.on('match-found', function (data) {
    currentRoomId = data.roomId;
    if (typeof showScreen === 'function') showScreen('screen-placement');
  });

  // ---- matchmaking: status update -------------------------------------------
  socket.on('matchmaking', function (data) {
    if (data.status === 'waiting') {
      if (typeof showScreen === 'function') showScreen('screen-waiting');
    } else if (data.status === 'timeout') {
      showNotification('No opponent found. Try again or play vs AI.');
      if (typeof showScreen === 'function') showScreen('screen-menu');
    }
  });

  // ---- ships-placed: this player placed ships successfully ------------------
  socket.on('ships-placed', function (data) {
    // In multiplayer, show a "waiting for opponent" notice
    var waitingContent = document.querySelector('#screen-placement .placement-controls');
    if (waitingContent) {
      var readyBtn = document.getElementById('btn-ready');
      if (readyBtn) readyBtn.disabled = true;
    }
    showNotification('FLEET DEPLOYED — AWAITING ENEMY CONTACT');
  });

  // ---- game-start: both players ready, game begins --------------------------
  socket.on('game-start', function (data) {
    enemySunkShips = [];
    if (typeof showScreen === 'function') showScreen('screen-game');
    showDifficultyBadge();
    updateEnemySunkTracker();
    // Request full state after showing game screen
    if (socket) socket.emit('get-state');
  });

  // ---- game-state: full state update ----------------------------------------
  socket.on('game-state', function (data) {
    currentRoomId = data.roomId;

    // Determine if it is my turn
    myTurn = (data.currentTurn === socket.id);
    updateTurnIndicator(myTurn);

    // Render boards
    if (data.myBoard && data.myBoard.grid) {
      renderBoard('board-player', data.myBoard.grid, false);
      updateBoard('board-player', data.myBoard.grid);
    }

    if (data.enemyBoard && data.enemyBoard.grid) {
      renderBoard('board-enemy', data.enemyBoard.grid, myTurn);
      updateBoard('board-enemy', data.enemyBoard.grid);
    }

    // Update ship status (own fleet)
    if (data.myBoard && data.myBoard.ships) {
      updateShipStatus(data.myBoard.ships);
    }

    // Update status message
    // status-message updated by updateTurnIndicator
  });

  // ---- fire-result: a shot was resolved ------------------------------------
  socket.on('fire-result', function (data) {
    var isMyShot = (data.shooter === socket.id);

    if (isMyShot) {
      // Update enemy board
      updateSingleCell('board-enemy', data.row, data.col, data.result);
      if (data.result === 'hit' || data.result === 'sunk') {
        SoundManager.play(data.sunk ? 'sunk' : 'hit');
        if (data.sunk) SoundManager.play('explosion');
        _shakeScreen(data.sunk ? 'heavy' : 'light');
      } else {
        SoundManager.play('miss');
      }
    } else {
      // Update own board
      updateSingleCell('board-player', data.row, data.col, data.result);
      if (data.result === 'hit' || data.result === 'sunk') {
        SoundManager.play(data.sunk ? 'sunk' : 'hit');
        if (data.sunk) SoundManager.play('explosion');
        _shakeScreen(data.sunk ? 'heavy' : 'light');
      } else {
        SoundManager.play('miss');
      }
    }

    // Track and show sunk ships
    if (data.sunk && data.shipName) {
      if (isMyShot) {
        enemySunkShips.push(data.shipName);
        updateEnemySunkTracker();
      }
      var shipUpper = data.shipName.toUpperCase();
      var msg = isMyShot
        ? 'ENEMY ' + shipUpper + ' DESTROYED'
        : shipUpper + ' LOST — HULL BREACH';
      showNotification(msg);
    }
  });

  // ---- turn-change: whose turn it is changed --------------------------------
  socket.on('turn-change', function (data) {
    myTurn = (data.currentTurn === socket.id);
    updateTurnIndicator(myTurn);

    // Re-render enemy board to enable/disable clicks
    var enemyBoard = document.getElementById('board-enemy');
    if (enemyBoard) {
      var cells = enemyBoard.querySelectorAll('.cell');
      cells.forEach(function (cell) {
        // Clone to strip old listeners, then re-attach if needed
        var newCell = cell.cloneNode(true);
        if (myTurn) {
          var row = parseInt(newCell.getAttribute('data-row'), 10);
          var col = parseInt(newCell.getAttribute('data-col'), 10);
          // Only add click if the cell is not already hit/miss/sunk
          if (!newCell.classList.contains('hit') &&
              !newCell.classList.contains('miss') &&
              !newCell.classList.contains('sunk')) {
            (function (r, c) {
              newCell.addEventListener('click', function () {
                fireAt(r, c);
              });
            })(row, col);
          }
        }
        cell.parentNode.replaceChild(newCell, cell);
      });
    }

    // status-message updated by updateTurnIndicator
  });

  // ---- game-over ------------------------------------------------------------
  socket.on('game-over', function (data) {
    var iWon = (data.winner === socket.id);
    myTurn = false;

    if (typeof showGameOver === 'function') {
      showGameOver({
        won: iWon,
        turns: data.turns,
        duration: data.duration,
        accuracy: data.accuracy,
        reason: data.reason,
        mode: data.mode
      });
    }
  });

  // ---- opponent-disconnected: opponent left, countdown to forfeit ----------
  socket.on('opponent-disconnected', function (data) {
    var seconds = data.timeout ? Math.round(data.timeout / 1000) : 30;
    showNotification('Opponent disconnected. Waiting ' + seconds + 's for reconnect...');
  });

  // ---- error ----------------------------------------------------------------
  socket.on('error', function (data) {
    showNotification(data.message || 'An error occurred');
  });
}

// ---------------------------------------------------------------------------
// Internal helper: update a single cell on a board
// ---------------------------------------------------------------------------
function updateSingleCell(containerId, row, col, state) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var cell = container.querySelector(
    '.cell[data-row="' + row + '"][data-col="' + col + '"]'
  );
  if (!cell) return;

  cell.classList.remove('hit', 'miss', 'ship', 'sunk');
  cell.textContent = '';

  if (state === 'hit') {
    cell.classList.add('hit');
    cell.textContent = '\u2715';
  } else if (state === 'miss') {
    cell.classList.add('miss');
    cell.textContent = '\u00B7';
  } else if (state === 'sunk') {
    cell.classList.add('sunk');
    cell.textContent = '\u2715';
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
SoundManager.init();

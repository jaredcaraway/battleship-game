/* particles.js — Canvas particle effects for hit explosions and miss splashes
 * Exposes: spawnHitParticles(boardId, row, col), spawnMissParticles(boardId, row, col)
 */

'use strict';

var ParticleSystem = (function () {
  var canvas = null;
  var ctx = null;
  var particles = [];
  var animating = false;

  function _ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
  }

  function _resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function _getCellCenter(boardId, row, col) {
    var board = document.getElementById(boardId);
    if (!board) return null;
    var cell = board.querySelector('.cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!cell) return null;
    var rect = cell.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
  }

  function _animate() {
    if (particles.length === 0) {
      animating = false;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    animating = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      p.size *= p.shrink;

      if (p.life <= 0 || p.size < 0.3) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Trailing ember for hit particles
      if (p.trail) {
        ctx.globalAlpha = p.life * 0.3;
        ctx.beginPath();
        ctx.arc(p.x - p.vx * 2, p.y - p.vy * 2, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(_animate);
  }

  function _startIfNeeded() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(_animate);
    }
  }

  function spawnHit(boardId, row, col) {
    if (typeof MotionSettings !== 'undefined' && !MotionSettings.enabled) return;
    _ensureCanvas();
    var center = _getCellCenter(boardId, row, col);
    if (!center) return;

    var colors = ['#ff4444', '#ff6600', '#ffaa00', '#ff2200', '#ffcc33'];
    var count = 20 + Math.floor(Math.random() * 10);

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1 + Math.random() * 4;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: center.x + (Math.random() - 0.5) * center.size * 0.3,
        y: center.y + (Math.random() - 0.5) * center.size * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        gravity: 0.08,
        size: 1.5 + Math.random() * 3,
        shrink: 0.97,
        life: 0.8 + Math.random() * 0.2,
        decay: 0.015 + Math.random() * 0.01,
        color: color,
        glow: true,
        trail: Math.random() > 0.4
      });
    }

    // Central flash
    particles.push({
      x: center.x,
      y: center.y,
      vx: 0,
      vy: 0,
      gravity: 0,
      size: center.size * 0.6,
      shrink: 0.85,
      life: 1,
      decay: 0.08,
      color: '#ffaa00',
      glow: true,
      trail: false
    });

    _startIfNeeded();
  }

  function spawnMiss(boardId, row, col) {
    if (typeof MotionSettings !== 'undefined' && !MotionSettings.enabled) return;
    _ensureCanvas();
    var center = _getCellCenter(boardId, row, col);
    if (!center) return;

    var colors = ['#88ccff', '#aaddff', '#ffffff', '#66bbee'];
    var count = 12 + Math.floor(Math.random() * 6);

    for (var i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      var speed = 1.5 + Math.random() * 3;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: center.x + (Math.random() - 0.5) * center.size * 0.5,
        y: center.y,
        vx: Math.cos(angle) * speed * 0.5,
        vy: Math.sin(angle) * speed,
        gravity: 0.12,
        size: 1 + Math.random() * 2,
        shrink: 0.96,
        life: 0.6 + Math.random() * 0.3,
        decay: 0.02 + Math.random() * 0.01,
        color: color,
        glow: true,
        trail: false
      });
    }

    _startIfNeeded();
  }

  function spawnSunk(boardId, row, col) {
    if (typeof MotionSettings !== 'undefined' && !MotionSettings.enabled) return;
    _ensureCanvas();
    var center = _getCellCenter(boardId, row, col);
    if (!center) return;

    var colors = ['#ff4444', '#ff6600', '#ffaa00', '#ff2200', '#ffcc33', '#ffffff'];
    var count = 40 + Math.floor(Math.random() * 15);

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 6;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: center.x + (Math.random() - 0.5) * center.size,
        y: center.y + (Math.random() - 0.5) * center.size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        gravity: 0.06,
        size: 2 + Math.random() * 4,
        shrink: 0.96,
        life: 0.9 + Math.random() * 0.1,
        decay: 0.01 + Math.random() * 0.008,
        color: color,
        glow: true,
        trail: true
      });
    }

    // Big central flash
    particles.push({
      x: center.x,
      y: center.y,
      vx: 0,
      vy: 0,
      gravity: 0,
      size: center.size,
      shrink: 0.82,
      life: 1,
      decay: 0.06,
      color: '#ffffff',
      glow: true,
      trail: false
    });

    _startIfNeeded();
  }

  return {
    spawnHit: spawnHit,
    spawnMiss: spawnMiss,
    spawnSunk: spawnSunk
  };
})();

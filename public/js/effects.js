/* effects.js — Ambient visual effects: matrix rain, cursor trail
 * Loaded after ui.js. Respects MotionSettings.
 */

'use strict';

console.log('[effects.js] loaded — matrix rain + cursor trail active');

// ---------------------------------------------------------------------------
// Matrix Rain (#98)
// ---------------------------------------------------------------------------
(function () {
  var canvas = document.createElement('canvas');
  canvas.id = 'matrix-rain';
  canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.06;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var columns = [];
  var fontSize = 14;
  var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var colCount = Math.floor(canvas.width / fontSize);
    while (columns.length < colCount) columns.push(Math.random() * canvas.height / fontSize | 0);
    columns.length = colCount;
  }

  var lastDraw = 0;
  var frameInterval = 100; // ~10fps

  function draw(timestamp) {
    if (timestamp - lastDraw < frameInterval) {
      requestAnimationFrame(draw);
      return;
    }
    lastDraw = timestamp;

    ctx.fillStyle = 'rgba(13, 13, 13, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00ff80';
    ctx.font = fontSize + 'px monospace';

    for (var i = 0; i < columns.length; i++) {
      var char = chars[Math.random() * chars.length | 0];
      ctx.fillText(char, i * fontSize, columns[i] * fontSize);

      if (columns[i] * fontSize > canvas.height && Math.random() > 0.975) {
        columns[i] = 0;
      }
      columns[i]++;
    }

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();

// ---------------------------------------------------------------------------
// Cursor Trail (#100)
// ---------------------------------------------------------------------------
(function () {
  var particles = [];
  var maxParticles = 25;

  document.addEventListener('mousemove', function (e) {

    particles.push({
      x: e.clientX,
      y: e.clientY,
      life: 1,
      el: null
    });

    if (particles.length > maxParticles) {
      var old = particles.shift();
      if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  });

  function tick() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= 0.04;

      if (!p.el) {
        p.el = document.createElement('div');
        p.el.style.cssText = 'position:fixed;pointer-events:none;z-index:9997;border-radius:50%;background:#00ff80;';
        document.body.appendChild(p.el);
      }

      if (p.life <= 0) {
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        particles.splice(i, 1);
        continue;
      }

      var size = 6 * p.life;
      p.el.style.width = size + 'px';
      p.el.style.height = size + 'px';
      p.el.style.left = (p.x - size / 2) + 'px';
      p.el.style.top = (p.y - size / 2) + 'px';
      p.el.style.opacity = p.life * 0.7;
      p.el.style.boxShadow = '0 0 ' + (4 * p.life) + 'px #00ff80';
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

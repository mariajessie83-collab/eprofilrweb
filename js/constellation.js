// Simple constellation background module
// Usage: constellation.init('constellation-canvas')
(function () {
  const mod = {
    init: function (canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      function setCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      setCanvasSize();

      // Static (non-interactive) design: no mouse influence
      const mouse = { x: undefined, y: undefined, radius: 0 };
      window.addEventListener('resize', () => { setCanvasSize(); init(); });

      let particles = [];
      // Back to simple, bold constellation: fewer points, thicker and longer lines
      const MAX_DISTANCE = 155;           // longer reach
      const LINE_WIDTH = 2.0;             // bolder lines

      class Particle {
        constructor(x, y, dx, dy, size) {
          this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.size = size;
        }
        draw() {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        update() {
          if (this.x > window.innerWidth || this.x < 0) this.dx *= -1;
          if (this.y > window.innerHeight || this.y < 0) this.dy *= -1;
          // No mouse repulsion; particles just float
          this.x += this.dx; this.y += this.dy;
          this.draw();
        }
      }

      function init() {
        particles = [];
        const count = (window.innerWidth * window.innerHeight) / 7500; // fewer, larger links
        for (let i = 0; i < count; i++) {
          const size = (Math.random() * 1.0) + 2.4;
          const x = Math.random() * window.innerWidth;
          const y = Math.random() * window.innerHeight;
          const dx = (Math.random() * 0.4) - 0.2;
          const dy = (Math.random() * 0.4) - 0.2;
          particles.push(new Particle(x, y, dx, dy, size));
        }
      }

      function connect() {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < MAX_DISTANCE) {
              const a = Math.max(0.08, 1 - (d / MAX_DISTANCE));
              ctx.strokeStyle = `rgba(255,255,255,${a})`;
              ctx.lineWidth = LINE_WIDTH;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      function animate() {
        ctx.clearRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight);
        for (let i = 0; i < particles.length; i++) particles[i].update();
        connect();
        requestAnimationFrame(animate);
      }

      init();
      animate();
    }
  };
  window.constellation = mod;
})();



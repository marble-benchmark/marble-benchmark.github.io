/* Navigation scrollspy, BibTeX copy control, and subtle isometric background lattice. */
(() => {
  /* 1. Sticky topbar active section indicator */
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections = navLinks
    .map(link => ({ link, target: document.querySelector(link.getAttribute('href')) }))
    .filter(item => item.target);

  function updateNav() {
    const scrollY = window.scrollY;
    let active = sections[0];
    for (const item of sections) {
      if (item.target.getBoundingClientRect().top <= 130) {
        active = item;
      }
    }
    if (scrollY < 100 && sections[0]) active = sections[0];
    navLinks.forEach(a => a.classList.toggle('on', active && a === active.link));
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* 2. Copy BibTeX button with fallback */
  const copyBtn = document.getElementById('copy-citation');
  const bibEl = document.getElementById('bibtex');
  if (copyBtn && bibEl) {
    copyBtn.addEventListener('click', async () => {
      const text = bibEl.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 1800);
    });
  }

  /* 3. Quiet architectural spatial-lattice canvas in outer margins */
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let nodes = [];
  let rafId = null;

  function initNodes() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(34, Math.max(16, Math.round((width * height) / 48000)));
    nodes = [];
    for (let i = 0; i < count; i++) {
      // Favor outer left/right flanks so center editorial column stays calm
      const side = i % 2 === 0 ? Math.random() * 0.24 : 0.76 + Math.random() * 0.24;
      const x = width < 1040 ? Math.random() * width : side * width;
      const y = Math.random() * height;
      const angle = (Math.PI / 3) * Math.floor(Math.random() * 6);
      const speed = 0.08 + Math.random() * 0.1;
      nodes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2.2 + Math.random() * 2.2,
        tint: i % 5 === 0 ? 'rgba(180, 89, 102, 0.28)' : i % 3 === 0 ? 'rgba(63, 122, 108, 0.24)' : 'rgba(75, 107, 132, 0.26)',
      });
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    const maxDist = 175;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!reducedMotion) {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < -30) a.x = width + 30;
        if (a.x > width + 30) a.x = -30;
        if (a.y < -30) a.y = height + 30;
        if (a.y > height + 30) a.y = -30;
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.14;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(75, 107, 132, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = n.tint;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (!reducedMotion) {
      rafId = requestAnimationFrame(drawFrame);
    }
  }

  initNodes();
  drawFrame();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (rafId) cancelAnimationFrame(rafId);
      initNodes();
      drawFrame();
    }, 180);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden && !reducedMotion && !rafId) {
      drawFrame();
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const applyTheme = (theme) => {
  // Interactive moving diagram (nodes + links around center)
  (function initDiagram(){
    const wrap = document.getElementById('motionDiagram');
    const canvas = document.getElementById('diagramCanvas');
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    function resize(){
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.floor(r.width * DPR);
      canvas.height = Math.floor(r.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Graph parameters (dynamic density)
    let N = 0; // computed in resetNodes by container size
    const center = { x: 0, y: 0 };
    let nodes = [];
    let t = 0;
    let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let colorText = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#111';
    // Shape morphing state
    const modes = ['circle','ellipse','rose4','rose5','lissajous','lemniscate'];
    let mode = 'circle';
    let prevMode = 'circle';
    let morph = 1; // 0..1
    let nextModeAt = performance.now() + 11000; // switch after ~11s initially
    function pickNextMode(){
      const picks = modes.filter(m => m !== mode);
      return picks[Math.floor(Math.random() * picks.length)] || 'circle';
    }

    function resetNodes(){
      const r = Math.min(wrap.clientWidth, wrap.clientHeight) * 0.32;
      const area = Math.max(1, wrap.clientWidth * wrap.clientHeight);
      // density: 1 node per ~6000 px^2, clamped for perf
      N = Math.max(96, Math.min(220, Math.round(area / 6000)));
      nodes = [];
      for (let i=0;i<N;i++){
        const a = (i / N) * Math.PI * 2;
        nodes.push({ a, r: r * (0.9 + Math.random()*0.2), s: 0.4 + Math.random()*0.8 });
      }
    }
    resetNodes();
    window.addEventListener('resize', resetNodes);

    function updatePointer(x, y){
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      pointer.tx = (x - cx) / rect.width; // -0.5..0.5
      pointer.ty = (y - cy) / rect.height;
    }
    window.addEventListener('mousemove', (e)=> updatePointer(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e)=>{ const p=e.touches[0]; if (p) updatePointer(p.clientX, p.clientY); }, {passive:true});

    // Update colors on theme change
    window.addEventListener('theme:changed', () => {
      colorText = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#111';
    });

    function draw(){
      const w = canvas.width / DPR, h = canvas.height / DPR;
      ctx.clearRect(0,0,w,h);
      center.x = w/2;
      center.y = h/2;

      // clean background (no grid)

      // animate nodes
      t += 0.016;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;

      const baseR = Math.min(w,h)*0.33; // slightly larger figure
      const ox = 0, oy = 0; // fixed position (no pointer drift)

      // handle shape mode switching and morphing
      const now = performance.now();
      if (now >= nextModeAt && morph >= 0.999) {
        prevMode = mode;
        mode = pickNextMode();
        morph = 0;
        nextModeAt = now + 9000 + Math.random()*6000; // 9–15s
      } else if (morph < 1) {
        morph = Math.min(1, morph + 0.018); // ~1s smooth morph
      }

      const ease = (m)=> m<0.5 ? 4*m*m*m : 1 - Math.pow(-2*m+2,3)/2;
      const em = ease(morph);

      // links (multi-pass for complexity)
      const posFor = (which, idx) => {
        const n = nodes[idx];
        const a = n.a + t * (0.15*n.s + 0.05);
        const jitter = 1.0 + 0.04*Math.sin(t*0.9 + idx);
        let x=0, y=0;
        if (which === 'circle') {
          const r = baseR * jitter;
          x = center.x + Math.cos(a)*r;
          y = center.y + Math.sin(a)*r;
        } else if (which === 'ellipse') {
          const rx = baseR * 1.05 * jitter;
          const ry = baseR * 0.62 * jitter;
          x = center.x + Math.cos(a)*rx;
          y = center.y + Math.sin(a)*ry;
        } else if (which === 'rose4') {
          const rf = 0.55 + 0.45*Math.abs(Math.cos(4*a));
          const r = baseR * 0.95 * rf;
          x = center.x + Math.cos(a)*r;
          y = center.y + Math.sin(a)*r;
        } else if (which === 'rose5') {
          const rf = 0.55 + 0.45*Math.abs(Math.cos(5*a));
          const r = baseR * 0.95 * rf;
          x = center.x + Math.cos(a)*r;
          y = center.y + Math.sin(a)*r;
        } else if (which === 'lissajous') {
          const rx = baseR * 1.02;
          const ry = baseR * 0.58;
          x = center.x + rx * Math.cos(3*a + 0.2*t);
          y = center.y + ry * Math.sin(2*a + 0.3*t);
        } else if (which === 'lemniscate') {
          // approximate Bernoulli lemniscate in polar: r^2 = a^2 cos(2θ)
          const c = Math.cos(2*a);
          const sgn = Math.sign(c) || 1;
          const r = baseR * 0.9 * Math.sqrt(Math.max(0, Math.abs(c)));
          x = center.x + Math.cos(a)*r*sgn;
          y = center.y + Math.sin(a)*r*sgn;
        }
        return { x: x + ox*0.2, y: y + oy*0.2 };
      };
      const pos = (idx) => {
        if (morph >= 0.999) return posFor(mode, idx);
        const p0 = posFor(prevMode, idx);
        const p1 = posFor(mode, idx);
        return { x: p0.x + (p1.x - p0.x)*em, y: p0.y + (p1.y - p0.y)*em };
      };

      // pass 1: ring neighbors
      ctx.strokeStyle = colorText || '#111';
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let i=0;i<N;i++){
        const p1 = pos(i);
        const p2 = pos((i+1)%N);
        const mx = (p1.x+p2.x)/2 + (center.x - (p1.x+p2.x)/2)*0.12;
        const my = (p1.y+p2.y)/2 + (center.y - (p1.y+p2.y)/2)*0.12;
        ctx.moveTo(p1.x,p1.y);
        ctx.quadraticCurveTo(mx,my,p2.x,p2.y);
      }
      ctx.stroke();

      // pass 2: skip connections (i->i+3 and i->i+7)
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let i=0;i<N;i++){
        const p1 = pos(i);
        const p2 = pos((i+3)%N);
        const p3 = pos((i+7)%N);
        let mx = (p1.x+p2.x)/2 + (center.x - (p1.x+p2.x)/2)*0.18;
        let my = (p1.y+p2.y)/2 + (center.y - (p1.y+p2.y)/2)*0.18;
        ctx.moveTo(p1.x,p1.y);
        ctx.quadraticCurveTo(mx,my,p2.x,p2.y);
        mx = (p1.x+p3.x)/2 + (center.x - (p1.x+p3.x)/2)*0.16;
        my = (p1.y+p3.y)/2 + (center.y - (p1.y+p3.y)/2)*0.16;
        ctx.moveTo(p1.x,p1.y);
        ctx.quadraticCurveTo(mx,my,p3.x,p3.y);
      }
      ctx.stroke();

      // pass 3: dynamic long chords (sparse)
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      for (let i=0;i<N;i+=5){ // every 5th node for sparsity
        const p1 = pos(i);
        const offset = 11 + Math.floor(5 * Math.sin(t*0.8 + i));
        const j = (i + offset) % N;
        const p2 = pos(j);
        const mx = (p1.x+p2.x)/2 + (center.x - (p1.x+p2.x)/2)*0.25;
        const my = (p1.y+p2.y)/2 + (center.y - (p1.y+p2.y)/2)*0.25;
        ctx.moveTo(p1.x,p1.y);
        ctx.quadraticCurveTo(mx,my,p2.x,p2.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // no center nucleus (removed per request)

      // nodes
      for (let i=0;i<N;i++){
        const n = nodes[i];
        const a = n.a + t * (0.15*n.s + 0.05);
        const r = baseR * (1.0 + 0.04*Math.sin(t*0.9 + i));
        const x = center.x + Math.cos(a)*r + ox*0.2;
        const y = center.y + Math.sin(a)*r + oy*0.2;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI*2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  })();

    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('theme', theme);
    // update active buttons
    const lightBtn = document.getElementById('themeLight');
    const darkBtn = document.getElementById('themeDark');
    if (lightBtn && darkBtn) {
      lightBtn.classList.toggle('active', theme === 'light');
      darkBtn.classList.toggle('active', theme === 'dark');
    }
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
      const isDark = theme === 'dark';
      themeSwitch.classList.toggle('active', isDark);
      themeSwitch.setAttribute('aria-pressed', String(isDark));
    }
    // notify WebGL to update shader colors
    window.dispatchEvent(new CustomEvent('theme:changed', { detail: theme }));
  };

  const applyMono = (isMono) => {
    document.body.classList.toggle('font-mono', isMono);
    localStorage.setItem('fontMono', isMono ? '1' : '0');
    const monoBtn = document.getElementById('fontMono');
    if (monoBtn) monoBtn.classList.toggle('active', isMono);
  };

  // initialize from storage
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const savedMono = localStorage.getItem('fontMono') === '1';
  applyTheme(savedTheme);
  applyMono(savedMono);

  // bind controls
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  const monoBtn = document.getElementById('fontMono');
  if (lightBtn) lightBtn.addEventListener('click', () => applyTheme('light'));
  if (darkBtn) darkBtn.addEventListener('click', () => applyTheme('dark'));
  if (monoBtn) monoBtn.addEventListener('click', () => applyMono(!document.body.classList.contains('font-mono')));

  const themeSwitch = document.getElementById('themeSwitch');
  if (themeSwitch) {
    themeSwitch.addEventListener('click', () => {
      const current = localStorage.getItem('theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // highlight active link in side-nav
  const navLinks = document.querySelectorAll('.side-nav a');
  if (navLinks.length) {
    const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    navLinks.forEach(a => {
      const href = (a.getAttribute('href') || '').replace('./', '').toLowerCase();
      const target = href === '' ? 'index.html' : href === '/' ? 'index.html' : href;
      if (current === target || (current === '' && target === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  // Typewriter effect: loop typing and erasing for the name near the toggle
  const nameEl = document.querySelector('.vertical-name');
  if (nameEl) {
    const fullName = (nameEl.getAttribute('data-text') || nameEl.textContent || 'Dionisie Rosca').trim();
    const typeSpeed = 85;     // ms per character when typing
    const eraseSpeed = 65;    // ms per character when erasing
    const pauseAtFull = 1100; // ms pause when full text is shown
    const pauseAtEmpty = 700; // ms pause when text is erased

    nameEl.textContent = '';
    nameEl.classList.add('typing');

    let i = 0;
    let typingForward = true;

    function step() {
      if (typingForward) {
        // type next character
        nameEl.textContent = fullName.slice(0, i + 1);
        i++;
        if (i >= fullName.length) {
          // reached full, pause then start erasing
          setTimeout(() => {
            typingForward = false;
            step();
          }, pauseAtFull);
          return;
        }
        setTimeout(step, typeSpeed);
      } else {
        // erase previous character
        nameEl.textContent = fullName.slice(0, Math.max(0, i - 1));
        i--;
        if (i <= 0) {
          // fully erased, pause then start typing again
          setTimeout(() => {
            typingForward = true;
            step();
          }, pauseAtEmpty);
          return;
        }
        setTimeout(step, eraseSpeed);
      }
    }
    step();
  }


  // Contact form (static demo handler)
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    const statusEl = document.getElementById('formStatus');
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      if (!name || !email || !message) {
        if (statusEl) statusEl.textContent = 'Preencha todos os campos.';
        return;
      }
      // Demo submit: just show a success message and clear fields
      if (statusEl) statusEl.textContent = 'Mensagem enviada (demo). Obrigado!';
      contactForm.reset();
    });
  }

  // Center moving effect for code face block
  const face = document.getElementById('codeFace');
  if (face) {
    let px = 0, py = 0; // pointer normalized -1..1
    let targetX = 0, targetY = 0;
    const limitRot = 12; // stronger rotation
    const limitMove = 24; // stronger translation
    const lerp = (a,b,t)=>a+(b-a)*t;

    function onMove(x, y) {
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const nx = Math.max(-1, Math.min(1, (x - cx) / (rect.width/2)));
      const ny = Math.max(-1, Math.min(1, (y - cy) / (rect.height/2)));
      targetX = nx; targetY = ny;
    }

    window.addEventListener('mousemove', (e)=> onMove(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e)=>{
      const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY);
    }, { passive: true });

    let t0 = performance.now();
    function animate(now){
      const dt = Math.min(1, (now - t0) / 1000); t0 = now;
      // gentle idle drift if no movement
      const idleX = Math.sin(now*0.0007) * 0.08;
      const idleY = Math.cos(now*0.0009) * 0.08;
      // ease pointer
      px = lerp(px, targetX || idleX, 0.18);
      py = lerp(py, targetY || idleY, 0.18);
      const tx = -px * limitMove;
      const ty = -py * limitMove;
      const rx = py * limitRot;
      const ry = -px * limitRot;
      face.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
});
